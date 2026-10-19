import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormProvider, useForm } from 'react-hook-form'

import { WorkspaceProfileFields } from './WorkspaceProfileFields'

import type { WorkspaceProfileValues } from '../model/form'

const sent: WorkspaceProfileValues[] = []

const Harness = ({ serverError }: { serverError?: string }) => {
  const form = useForm<WorkspaceProfileValues>({
    defaultValues: { name: '', description: '', icon: { kind: 'keep' } },
  })
  return (
    <FormProvider {...form}>
      <form
        onSubmit={(event) => {
          void form.handleSubmit((values) => {
            sent.push(values)
            if (serverError) form.setError('name', { type: 'server', message: serverError })
          })(event)
        }}
      >
        <WorkspaceProfileFields />
        <button type="submit">Отправить</button>
      </form>
    </FormProvider>
  )
}

beforeEach(() => {
  sent.length = 0
})

it('names its fields and previews the initials as the name is typed', async () => {
  render(<Harness />)

  await userEvent.type(screen.getByLabelText('Название сервера'), 'Команда Orbit')
  await userEvent.type(screen.getByLabelText(/Описание/), 'Про космос')

  expect(screen.getByRole('group', { name: 'Аватар' })).toHaveTextContent('КO')
  expect(screen.getByText('10 / 500')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))
  expect(sent).toEqual([
    { name: 'Команда Orbit', description: 'Про космос', icon: { kind: 'keep' } },
  ])
})

it('asks for a name and does not send a blank one', async () => {
  render(<Harness />)

  await userEvent.type(screen.getByLabelText('Название сервера'), '   ')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  const name = screen.getByLabelText('Название сервера')
  await waitFor(() => {
    expect(name).toHaveAttribute('aria-invalid', 'true')
  })
  expect(name).toHaveAccessibleDescription('Введите название сервера.')
  expect(sent).toEqual([])
})

it('shows a refusal of the server at the name', async () => {
  render(<Harness serverError="Название — от 1 до 64 символов." />)

  await userEvent.type(screen.getByLabelText('Название сервера'), 'Команда')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Название — от 1 до 64 символов.')
  expect(screen.getByLabelText('Название сервера')).toHaveAttribute('aria-invalid', 'true')
})
