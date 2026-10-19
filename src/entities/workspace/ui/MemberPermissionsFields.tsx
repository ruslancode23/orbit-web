import { useId } from 'react'
import { Controller, useFormContext } from 'react-hook-form'

import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'

import type { MemberPermissionValues } from '../model/form'
import type { MemberPermission } from '../model/workspace'

const PERMISSIONS: { key: MemberPermission; title: string; hint: string }[] = [
  {
    key: 'canInvite',
    title: 'Приглашать людей',
    hint: 'Участники могут создавать ссылки-приглашения на сервер.',
  },
  {
    key: 'canCreateChannels',
    title: 'Создавать каналы',
    hint: 'Участники могут добавлять текстовые каналы. Каналы только для чтения создают администраторы.',
  },
  {
    key: 'canAttachFiles',
    title: 'Прикреплять файлы',
    hint: 'Участники могут отправлять в сообщениях файлы и изображения.',
  },
]

/**
 * What members of a server may do, as three switches, for any form that holds
 * `MemberPermissionValues` (`FormProvider` around it). The owner and admins
 * may always do all of it, which is said right above.
 */
export const MemberPermissionsFields = () => {
  const baseId = useId()
  const { control } = useFormContext<MemberPermissionValues>()

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-muted">
        Что можно обычным участникам. Владелец и администраторы могут всё это всегда.
      </p>
      <ul className="flex flex-col gap-4">
        {PERMISSIONS.map(({ key, title, hint }) => {
          const id = `${baseId}-${key}`
          return (
            <li key={key} className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor={id}>{title}</Label>
                <p id={`${id}-hint`} className="text-sm text-fg-muted">
                  {hint}
                </p>
              </div>
              <Controller
                control={control}
                name={key}
                render={({ field }) => (
                  <Switch
                    id={id}
                    ref={field.ref}
                    aria-describedby={`${id}-hint`}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
