import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'

import {
  describeWorkspaceError,
  MemberPermissionsFields,
  useUpdateWorkspace,
  type MemberPermission,
  type MemberPermissionValues,
  type Workspace,
} from '@/entities/workspace'
import { Button } from '@/shared/ui/button'

interface MemberPermissionsFormProps {
  workspace: Workspace
}

const KEYS: MemberPermission[] = ['canInvite', 'canCreateChannels', 'canAttachFiles']

/**
 * What members of a server may do. Only the flags that changed are sent; the
 * server applies them to everyone's next action right away.
 */
export const MemberPermissionsForm = ({ workspace }: MemberPermissionsFormProps) => {
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const update = useUpdateWorkspace()
  const form = useForm<MemberPermissionValues>({
    values: workspace.memberPermissions,
    resetOptions: { keepDirtyValues: true },
  })
  const { handleSubmit, reset, formState } = form

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    setSaved(false)
    const changed = KEYS.filter((key) => values[key] !== workspace.memberPermissions[key])
    const memberPermissions = Object.fromEntries(changed.map((key) => [key, values[key]]))
    try {
      await update.mutateAsync({ path: { workspaceId: workspace.id }, body: { memberPermissions } })
    } catch (error) {
      setFormError(describeWorkspaceError(error, 'Не получилось сохранить права.').message)
      return
    }
    reset(values)
    setSaved(true)
  })

  const busy = formState.isSubmitting

  return (
    <FormProvider {...form}>
      <form
        aria-label="Права участников"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void submit(event)
        }}
      >
        <MemberPermissionsFields />
        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy || !formState.isDirty}>
            Сохранить права
          </Button>
          <p role="status" className="text-sm text-fg-muted">
            {busy ? 'Сохраняем…' : saved && !formState.isDirty ? 'Сохранено' : null}
          </p>
        </div>
      </form>
    </FormProvider>
  )
}
