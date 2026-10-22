import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import {
  useCreateWorkspace,
  useUploadWorkspaceIcon,
  type MemberPermissionValues,
  type WorkspaceProfileValues,
} from '@/entities/workspace'
import {
  createChannelMutation,
  createRoleMutation,
  listChannelsQueryKey,
  listRolesQueryKey,
} from '@/shared/api'

import { STARTER_ROLES, type StarterRoleId } from '../config/starter-roles'
import { CHANNEL_TEMPLATES, type TemplateId } from '../config/templates'

import type { CreationProblems, CreationState } from './creation-notice'

/** One starter role: whether to make it, and under what name. */
export interface StarterRoleValue {
  enabled: boolean
  name: string
}

export interface CreateWorkspaceValues extends WorkspaceProfileValues, MemberPermissionValues {
  template: TemplateId
  roles: Record<StarterRoleId, StarterRoleValue>
}

/** What is being sent right now, for the status line. */
export type CreationStage = 'idle' | 'workspace' | 'icon' | 'channels' | 'roles'

/**
 * Creates a server the way the wizard promises: the server, then its icon,
 * then the starting channels and roles, then opens it. Only the first step can fail the
 * whole thing — it rejects, and the wizard shows why. After it, the server
 * exists: a failed icon, channel or role is remembered and reported in the server,
 * never a reason to lose it.
 */
export function useCreateWorkspaceFlow() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [stage, setStage] = useState<CreationStage>('idle')
  const createWorkspace = useCreateWorkspace()
  const uploadIcon = useUploadWorkspaceIcon()
  const createChannel = useMutation(createChannelMutation())
  const createRole = useMutation(createRoleMutation())

  const run = async (values: CreateWorkspaceValues) => {
    setStage('workspace')
    let workspaceId: string
    try {
      const membership = await createWorkspace.mutateAsync({
        body: {
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          memberPermissions: {
            canInvite: values.canInvite,
            canCreateChannels: values.canCreateChannels,
            canAttachFiles: values.canAttachFiles,
          },
        },
      })
      workspaceId = membership.workspace.id
    } catch (error) {
      setStage('idle')
      throw error
    }

    const problems: CreationProblems = { iconFailed: false, failedChannels: [], failedRoles: [] }
    if (values.icon.kind === 'set') {
      setStage('icon')
      await uploadIcon
        .mutateAsync({ path: { workspaceId }, body: { file: values.icon.file } })
        .catch(() => {
          problems.iconFailed = true
        })
    }

    const template = CHANNEL_TEMPLATES.find((item) => item.id === values.template)
    let firstChannelId: string | undefined
    if (template?.channels.length) {
      setStage('channels')
      // One after another, so they come out in the order of the template.
      for (const channel of template.channels) {
        try {
          const created = await createChannel.mutateAsync({ path: { workspaceId }, body: channel })
          firstChannelId ??= created.id
        } catch {
          problems.failedChannels.push(channel.name)
        }
      }
      await queryClient.invalidateQueries({
        queryKey: listChannelsQueryKey({ path: { workspaceId } }),
      })
    }

    const roles = STARTER_ROLES.filter((role) => values.roles[role.id].enabled)
    if (roles.length > 0) {
      setStage('roles')
      // Highest first: each new role lands right above @everyone.
      for (const role of roles) {
        const name = values.roles[role.id].name.trim()
        try {
          await createRole.mutateAsync({
            path: { workspaceId },
            body: { name, color: role.color, hoist: true, permissions: role.permissions },
          })
        } catch {
          problems.failedRoles.push(name)
        }
      }
      await queryClient.invalidateQueries({
        queryKey: listRolesQueryKey({ path: { workspaceId } }),
      })
    }

    const state: CreationState | null =
      problems.iconFailed || problems.failedChannels.length || problems.failedRoles.length
        ? { creationProblems: problems }
        : null
    await navigate(firstChannelId ? `/s/${workspaceId}/${firstChannelId}` : `/s/${workspaceId}`, {
      state,
    })
  }

  return { run, stage }
}
