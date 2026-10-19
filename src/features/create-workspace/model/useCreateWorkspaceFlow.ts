import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import {
  useCreateWorkspace,
  useUploadWorkspaceIcon,
  type MemberPermissionValues,
  type WorkspaceProfileValues,
} from '@/entities/workspace'
import { createChannelMutation, listChannelsQueryKey } from '@/shared/api'

import { CHANNEL_TEMPLATES, type TemplateId } from '../config/templates'

import type { CreationProblems, CreationState } from './creation-notice'

export interface CreateWorkspaceValues extends WorkspaceProfileValues, MemberPermissionValues {
  template: TemplateId
}

/** What is being sent right now, for the status line. */
export type CreationStage = 'idle' | 'workspace' | 'icon' | 'channels'

/**
 * Creates a server the way the wizard promises: the server, then its icon,
 * then the starting channels, then opens it. Only the first step can fail the
 * whole thing — it rejects, and the wizard shows why. After it, the server
 * exists: a failed icon or channel is remembered and reported in the server,
 * never a reason to lose it.
 */
export function useCreateWorkspaceFlow() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [stage, setStage] = useState<CreationStage>('idle')
  const createWorkspace = useCreateWorkspace()
  const uploadIcon = useUploadWorkspaceIcon()
  const createChannel = useMutation(createChannelMutation())

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

    const problems: CreationProblems = { iconFailed: false, failedChannels: [] }
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

    const state: CreationState | null =
      problems.iconFailed || problems.failedChannels.length ? { creationProblems: problems } : null
    await navigate(firstChannelId ? `/s/${workspaceId}/${firstChannelId}` : `/s/${workspaceId}`, {
      state,
    })
  }

  return { run, stage }
}
