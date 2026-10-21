import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { getUserProfileQueryKey, type StatusUpdate, type UserProfile } from '@/shared/api'
import { renderWithProviders } from '@/shared/lib/test'

import { SetStatusDialog } from './SetStatusDialog'

const me: UserProfile = {
  id: 'u-me',
  nickname: 'anna',
  displayName: 'Анна',
  accentColor: 'violet',
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-10-18T10:00:00Z'),
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

interface Call {
  method: string
  path: string
  body?: unknown
}

const stubStatusApi = (profile: UserProfile) => {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      if (url.pathname === '/api/v1/users/me/status' && request.method === 'PUT') {
        const body = (await request.clone().json()) as StatusUpdate
        calls.push({ method: 'PUT', path: url.pathname, body })
        return json({
          ...profile,
          customStatus: {
            ...(body.emoji === undefined ? {} : { emoji: body.emoji }),
            ...(body.text === undefined ? {} : { text: body.text }),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        })
      }
      if (url.pathname === '/api/v1/users/me/status' && request.method === 'DELETE') {
        calls.push({ method: 'DELETE', path: url.pathname })
        return json(profile)
      }
      return json({ error: { code: 'not_found', message: 'no' } }, 404)
    }),
  )
  return calls
}

const renderDialog = (profile: UserProfile = me) => {
  const onClose = vi.fn()
  const view = renderWithProviders(<SetStatusDialog profile={profile} onClose={onClose} />)
  return { ...view, onClose }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('saves an emoji, a text and a deadline', async () => {
  const calls = stubStatusApi(me)
  const { queryClient, onClose } = renderDialog()

  await userEvent.click(screen.getByRole('button', { name: '😎' }))
  await userEvent.type(screen.getByLabelText('Текст статуса'), 'На встрече до шести')
  await userEvent.selectOptions(screen.getByLabelText('Срок'), '4h')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

  await waitFor(() => {
    expect(calls).toEqual([
      {
        method: 'PUT',
        path: '/api/v1/users/me/status',
        body: { emoji: '😎', text: 'На встрече до шести', expiresIn: '4h' },
      },
    ])
  })
  expect(await screen.findByText('Статус обновлён')).toBeInTheDocument()
  expect(
    queryClient.getQueryData(getUserProfileQueryKey({ path: { userId: me.id } })),
  ).toMatchObject({ customStatus: { emoji: '😎', text: 'На встрече до шести' } })
  expect(onClose).toHaveBeenCalled()
})

it('clears the current status', async () => {
  const withStatus: UserProfile = {
    ...me,
    customStatus: { emoji: '☕', text: 'Кофе', expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  }
  const calls = stubStatusApi(me)
  const { onClose } = renderDialog(withStatus)

  await userEvent.click(screen.getByRole('button', { name: 'Очистить статус' }))

  await waitFor(() => {
    expect(calls).toEqual([{ method: 'DELETE', path: '/api/v1/users/me/status' }])
  })
  expect(await screen.findByText('Статус очищен')).toBeInTheDocument()
  expect(onClose).toHaveBeenCalled()
})

it('refuses an empty status instead of sending it', async () => {
  const calls = stubStatusApi(me)
  renderDialog()

  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

  expect(screen.getByRole('alert')).toHaveTextContent('Добавьте эмодзи или текст')
  expect(calls).toHaveLength(0)
})

it('does not offer to clear a status that is not set', () => {
  stubStatusApi(me)
  renderDialog()

  const dialog = screen.getByRole('dialog', { name: 'Задать статус' })
  expect(within(dialog).queryByRole('button', { name: 'Очистить статус' })).not.toBeInTheDocument()
})
