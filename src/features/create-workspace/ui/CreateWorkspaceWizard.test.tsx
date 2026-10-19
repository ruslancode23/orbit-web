import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'

import type * as ImageModule from '@/shared/lib/image'
import { renderWithProviders } from '@/shared/lib/test'

import { CreateWorkspaceWizard } from './CreateWorkspaceWizard'
import { CreationNotice } from './CreationNotice'

// jsdom has no canvas: the drawing itself is the browser's part.
vi.mock('@/shared/lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof ImageModule>()),
  renderSquare: vi.fn(() =>
    Promise.resolve({ blob: new Blob(['x'], { type: 'image/webp' }), dataUrl: 'data:,cropped' }),
  ),
}))

const workspaceId = '0b7e6c1a-2f4d-4c1e-9a3b-5d6e7f8a9b0c'

const membership = {
  workspace: {
    id: workspaceId,
    name: 'Команда',
    description: 'Про космос',
    iconUrl: null,
    memberPermissions: { canInvite: true, canCreateChannels: false, canAttachFiles: true },
    ownerId: '6f1c0a9e-6b1a-4a3a-8f0e-2a4f1d2b3c4d',
    createdAt: '2026-10-20T10:00:00Z',
  },
  role: 'owner',
}

const channel = (name: string, index: number) => ({
  id: `c${String(index)}000000-0000-4000-8000-000000000000`,
  workspaceId,
  name,
  position: index,
  isReadOnly: false,
  canWrite: true,
  createdAt: '2026-10-20T10:00:00Z',
})

interface Call {
  method: string
  path: string
  body: unknown
}

type Answer = [status: number, body: unknown]

/**
 * Plays the server: answers by method and path, and keeps every request in
 * the order it came. `answers` overrides one route, such as a failing icon.
 */
const stubApi = (answers: Partial<Record<string, Answer>> = {}) => {
  const calls: Call[] = []
  let channels = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request) => {
      const path = new URL(input.url).pathname
      const route = `${input.method} ${path.replace(workspaceId, ':id')}`
      const isJson = input.headers.get('Content-Type')?.includes('json') ?? false
      const body: unknown = isJson ? await input.json() : await readUpload(input)
      calls.push({ method: input.method, path, body })
      const answer =
        answers[route] ??
        (route === 'POST /api/v1/workspaces'
          ? [201, membership]
          : route === 'PUT /api/v1/workspaces/:id/icon'
            ? [200, membership]
            : route === 'POST /api/v1/workspaces/:id/channels'
              ? [201, channel(isRecord(body) ? String(body.name) : '?', channels++)]
              : [200, []])
      const [status, payload] = answer
      return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  return calls
}

/** The `file` of a multipart body, as its type: the bytes are the cropper's business. */
const readUpload = async (input: Request) => {
  const form = await input.formData().catch(() => null)
  const file = form?.get('file')
  return file && typeof file !== 'string' ? { file: file.type } : null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const Where = () => {
  const location = useLocation()
  return <p data-testid="where">{location.pathname}</p>
}

const renderWizard = () =>
  renderWithProviders(
    <MemoryRouter initialEntries={['/new']}>
      <Routes>
        <Route path="/new" element={<CreateWorkspaceWizard />} />
        <Route
          path="/s/*"
          element={
            <>
              <Where />
              <CreationNotice />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )

const next = () => userEvent.click(screen.getByRole('button', { name: 'Далее' }))

const where = () => screen.findByTestId('where')

afterEach(() => {
  vi.unstubAllGlobals()
})

it('starts at the name and goes on with Enter', async () => {
  stubApi()
  renderWizard()

  await waitFor(() => {
    expect(screen.getByLabelText('Название сервера')).toHaveFocus()
  })
  expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Профиль')

  await userEvent.keyboard('Команда{Enter}')

  const heading = await screen.findByRole('heading', { name: 'С каких каналов начать?' })
  expect(heading).toHaveFocus()
  expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Каналы')
})

it('does not go on without a name', async () => {
  const calls = stubApi()
  renderWizard()

  await userEvent.type(screen.getByLabelText('Название сервера'), '   ')
  await next()

  expect(await screen.findByText('Введите название сервера.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Как назовём сервер?' })).toBeInTheDocument()
  expect(calls).toEqual([])
})

it('keeps what was typed when going back', async () => {
  stubApi()
  renderWizard()

  await userEvent.type(screen.getByLabelText('Название сервера'), 'Команда')
  await userEvent.type(screen.getByLabelText(/Описание/), 'Про космос')
  await next()
  await userEvent.click(screen.getByRole('radio', { name: /Для сообщества/ }))
  await next()
  await userEvent.click(screen.getByRole('switch', { name: 'Приглашать людей' }))

  await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
  expect(screen.getByRole('radio', { name: /Для сообщества/ })).toBeChecked()
  await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
  expect(screen.getByLabelText('Название сервера')).toHaveValue('Команда')
  expect(screen.getByLabelText(/Описание/)).toHaveValue('Про космос')

  await next()
  await next()
  expect(screen.getByRole('switch', { name: 'Приглашать людей' })).toBeChecked()
})

it('creates the server, its icon and channels in order, then opens the first channel', async () => {
  URL.createObjectURL = vi.fn(() => 'blob:picked')
  URL.revokeObjectURL = vi.fn()
  const calls = stubApi()
  renderWizard()

  await userEvent.type(screen.getByLabelText('Название сервера'), '  Команда ')
  await userEvent.type(screen.getByLabelText(/Описание/), 'Про космос')
  await userEvent.upload(
    screen.getByLabelText('Файл изображения'),
    new File([new Uint8Array(16)], 'icon.png', { type: 'image/png' }),
  )
  const dialog = screen.getByRole('dialog', { name: 'Обрезка аватара' })
  const image = dialog.querySelector('button img')
  if (!(image instanceof HTMLImageElement)) {
    throw new Error('no image')
  }
  Object.defineProperty(image, 'naturalWidth', { value: 300 })
  Object.defineProperty(image, 'naturalHeight', { value: 300 })
  fireEvent.load(image)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Применить' }))
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  await next()
  // «Для команды» is picked from the start.
  expect(screen.getByRole('radio', { name: /Для команды/ })).toBeChecked()
  await next()
  await userEvent.click(screen.getByRole('switch', { name: 'Приглашать людей' }))
  await userEvent.click(screen.getByRole('button', { name: 'Создать сервер' }))

  expect(await where()).toHaveTextContent(`/s/${workspaceId}/${channel('общий', 0).id}`)
  const writes = calls.filter((call) => call.method !== 'GET')
  expect(writes.map((call) => `${call.method} ${call.path}`)).toEqual([
    'POST /api/v1/workspaces',
    `PUT /api/v1/workspaces/${workspaceId}/icon`,
    `POST /api/v1/workspaces/${workspaceId}/channels`,
    `POST /api/v1/workspaces/${workspaceId}/channels`,
  ])
  expect(writes[0]?.body).toEqual({
    name: 'Команда',
    description: 'Про космос',
    memberPermissions: { canInvite: true, canCreateChannels: false, canAttachFiles: true },
  })
  expect(writes[1]?.body).toEqual({ file: 'image/webp' })
  expect(writes.slice(2).map((call) => call.body)).toEqual([
    { name: 'общий', topic: 'Новости и вопросы команды' },
    { name: 'оффтоп', topic: 'Всё, что не про работу' },
  ])
  // Nothing went wrong, nothing to report.
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

const fillAndCreate = async (template = /Для команды/) => {
  await userEvent.type(screen.getByLabelText('Название сервера'), 'Команда')
  await next()
  await userEvent.click(screen.getByRole('radio', { name: template }))
  await next()
  await userEvent.click(screen.getByRole('button', { name: 'Создать сервер' }))
}

it('opens the server without channels for the empty template', async () => {
  const calls = stubApi()
  renderWizard()

  await fillAndCreate(/Пустой/)

  expect(await where()).toHaveTextContent(new RegExp(`^/s/${workspaceId}$`))
  expect(calls.filter((call) => call.method !== 'GET')).toHaveLength(1)
})

// Once the server exists it is never lost: the person lands in it and is told
// what is missing.
it('opens the server anyway when a channel fails, and says which', async () => {
  stubApi({
    'POST /api/v1/workspaces/:id/channels': [500, { error: { code: 'internal', message: 'boom' } }],
  })
  renderWizard()

  await fillAndCreate()

  expect(await where()).toHaveTextContent(new RegExp(`^/s/${workspaceId}$`))
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Сервер создан, но не создались каналы #общий, #оффтоп.',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Понятно' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('goes back to the name when the server refuses it', async () => {
  stubApi({
    'POST /api/v1/workspaces': [
      400,
      { error: { code: 'invalid_request', message: 'servers: name must be 1 to 64 characters' } },
    ],
  })
  renderWizard()

  await fillAndCreate()

  expect(await screen.findByRole('alert')).toHaveTextContent('Название — от 1 до 64 символов.')
  expect(screen.getByLabelText('Название сервера')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText('Название сервера')).toHaveValue('Команда')
  expect(screen.queryByTestId('where')).not.toBeInTheDocument()
})

it('stays on the last step and says so when there is no connection', async () => {
  stubApi()
  renderWizard()
  await userEvent.type(screen.getByLabelText('Название сервера'), 'Команда')
  await next()
  await next()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
  )

  await userEvent.click(screen.getByRole('button', { name: 'Создать сервер' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Нет соединения с сервером.')
  expect(screen.getByRole('heading', { name: 'Что можно участникам?' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Создать сервер' })).toBeEnabled()
})
