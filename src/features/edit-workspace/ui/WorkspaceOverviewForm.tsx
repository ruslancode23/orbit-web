import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'

import {
  describeWorkspaceError,
  useDeleteWorkspaceIcon,
  useUpdateWorkspace,
  useUploadWorkspaceIcon,
  WorkspaceProfileFields,
  type Workspace,
  type WorkspaceProfileValues,
} from '@/entities/workspace'
import type { WorkspaceUpdateRequest } from '@/shared/api'
import { Button } from '@/shared/ui/button'

interface WorkspaceOverviewFormProps {
  workspace: Workspace
}

/**
 * Name, description and avatar of a server. Only what changed is sent: the
 * text in one PATCH, the avatar as an upload or a removal. The form follows
 * the server while nobody is typing in it — another admin's change arrives
 * through `workspace.updated` — and keeps what is being typed.
 */
export const WorkspaceOverviewForm = ({ workspace }: WorkspaceOverviewFormProps) => {
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const update = useUpdateWorkspace()
  const uploadIcon = useUploadWorkspaceIcon()
  const deleteIcon = useDeleteWorkspaceIcon()
  const form = useForm<WorkspaceProfileValues>({
    values: {
      name: workspace.name,
      description: workspace.description ?? '',
      icon: { kind: 'keep' },
    },
    resetOptions: { keepDirtyValues: true },
  })
  const { handleSubmit, setError, resetField, formState } = form
  const path = { workspaceId: workspace.id }

  const fail = (error: unknown) => {
    const { field, message } = describeWorkspaceError(error, 'Не получилось сохранить.')
    if (field) {
      setError(field, { type: 'server', message })
    } else {
      setFormError(message)
    }
  }

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    setSaved(false)
    const name = values.name.trim()
    const description = values.description.trim()
    const body: WorkspaceUpdateRequest = {}
    if (name !== workspace.name) {
      body.name = name
    }
    // An empty string clears the description on the server.
    if (description !== (workspace.description ?? '')) {
      body.description = description
    }

    if (body.name !== undefined || body.description !== undefined) {
      try {
        await update.mutateAsync({ path, body })
      } catch (error) {
        fail(error)
        return
      }
      // The text is saved even if the avatar below fails.
      resetField('name', { defaultValue: name })
      resetField('description', { defaultValue: description })
    }

    try {
      if (values.icon.kind === 'set') {
        await uploadIcon.mutateAsync({ path, body: { file: values.icon.file } })
      } else if (values.icon.kind === 'remove') {
        await deleteIcon.mutateAsync({ path })
      }
    } catch (error) {
      fail(error)
      return
    }
    resetField('icon', { defaultValue: { kind: 'keep' } })
    setSaved(true)
  })

  const busy = formState.isSubmitting

  return (
    <FormProvider {...form}>
      <form
        aria-label="Обзор"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void submit(event)
        }}
      >
        <WorkspaceProfileFields currentIconUrl={workspace.iconUrl} colorKey={workspace.id} />
        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy || !formState.isDirty}>
            Сохранить
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy || !formState.isDirty}
            onClick={() => {
              form.reset()
              setFormError(null)
            }}
          >
            Отменить
          </Button>
          <p role="status" className="text-sm text-fg-muted">
            {busy ? 'Сохраняем…' : saved && !formState.isDirty ? 'Сохранено' : null}
          </p>
        </div>
      </form>
    </FormProvider>
  )
}
