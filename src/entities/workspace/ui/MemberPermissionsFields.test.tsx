import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormProvider, useForm } from 'react-hook-form'

import { MemberPermissionsFields } from './MemberPermissionsFields'
import { DEFAULT_MEMBER_PERMISSIONS, type MemberPermissionValues } from '../model/form'

const sent: MemberPermissionValues[] = []

const Harness = () => {
  const form = useForm<MemberPermissionValues>({ defaultValues: DEFAULT_MEMBER_PERMISSIONS })
  return (
    <FormProvider {...form}>
      <form
        onSubmit={(event) => {
          void form.handleSubmit((values) => {
            sent.push(values)
          })(event)
        }}
      >
        <MemberPermissionsFields />
        <button type="submit">Сохранить</button>
      </form>
    </FormProvider>
  )
}

it('starts from the server defaults and explains each switch', () => {
  render(<Harness />)

  const invite = screen.getByRole('switch', { name: 'Приглашать людей' })
  expect(invite).not.toBeChecked()
  expect(invite).toHaveAccessibleDescription(/ссылки-приглашения/)
  expect(screen.getByRole('switch', { name: 'Создавать каналы' })).not.toBeChecked()
  expect(screen.getByRole('switch', { name: 'Прикреплять файлы' })).toBeChecked()
})

it('sends what was switched', async () => {
  render(<Harness />)

  await userEvent.click(screen.getByRole('switch', { name: 'Приглашать людей' }))
  screen.getByRole('switch', { name: 'Прикреплять файлы' }).focus()
  await userEvent.keyboard(' ')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

  expect(sent.at(-1)).toEqual({ canInvite: true, canCreateChannels: false, canAttachFiles: false })
})
