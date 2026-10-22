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
              : route === 'POST /api/v1/workspaces/:id/roles'
                ? [
                    201,
                    {
                      id: 'r-new',
                      name: 'роль',
                      hoist: true,
                      position: 1,
                      permissions: [],
                      isDefault: false,
                    },
                  ]
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
    `POST /api/v1/workspaces/${workspaceId}/roles`,
    `POST /api/v1/workspaces/${workspaceId}/roles`,
  ])
  expect(writes[0]?.body).toEqual({
    name: 'Команда',
    description: 'Про космос',
    memberPermissions: { canInvite: true, canCreateChannels: false, canAttachFiles: true },
  })
  expect(writes[1]?.body).toEqual({ file: 'image/webp' })
  expect(writes.slice(2, 4).map((call) => call.body)).toEqual([
    { name: 'общий', topic: 'Новости и вопросы команды' },
    { name: 'оффтоп', topic: 'Всё, что не про работу' },
  ])
  // Highest first: each new role lands right above @everyone.
  expect(writes.slice(4).map((call) => call.body)).toEqual([
    { name: 'Администратор', color: 'red', hoist: true, permissions: ['administrator'] },
    {
      name: 'Модератор',
      color: 'teal',
      hoist: true,
      permissions: ['kickMembers', 'banMembers', 'manageMessages'],
    },
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
  expect(calls.some((call) => call.path.endsWith('/channels'))).toBe(false)
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
  expect(screen.getByRole('heading', { name: 'Кто что может?' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Создать сервер' })).toBeEnabled()
})

const toRolesStep = async () => {
  await userEvent.type(screen.getByLabelText('Название сервера'), 'Команда')
  await next()
  await next()
  await screen.findByRole('heading', { name: 'Кто что может?' })
}

const roleName = (index: number) => {
  const field = screen.getAllByLabelText('Название роли')[index]
  if (!field) {
    throw new Error('no role name field')
  }
  return field
}

it('creates only the starter roles that were kept, under their new names', async () => {
  const calls = stubApi()
  renderWizard()
  await toRolesStep()

  await userEvent.click(screen.getByRole('checkbox', { name: /Создать роль «Модератор»/ }))
  await userEvent.clear(roleName(0))
  await userEvent.type(roleName(0), '  Старшие ')
  await userEvent.click(screen.getByRole('button', { name: 'Создать сервер' }))

  await where()
  const roles = calls.filter((call) => call.path.endsWith('/roles'))
  expect(roles.map((call) => call.body)).toEqual([
    { name: 'Старшие', color: 'red', hoist: true, permissions: ['administrator'] },
  ])
})

it('checks the role names before sending anything', async () => {
  const calls = stubApi()
  renderWizard()
  await toRolesStep()

  await userEvent.clear(roleName(0))
  await userEvent.type(roleName(0), 'модератор')
  await userEvent.click(screen.getByRole('button', { name: 'Создать сервер' }))

  expect(await screen.findAllByText('У двух ролей одинаковые названия.')).toHaveLength(2)
  expect(calls.filter((call) => call.method !== 'GET')).toEqual([])

  // Leaving the twin out settles it at once.
  await userEvent.click(screen.getByRole('checkbox', { name: /Создать роль «Модератор»/ }))
  await waitFor(() => {
    expect(screen.queryByText('У двух ролей одинаковые названия.')).not.toBeInTheDocument()
  })

  await userEvent.clear(roleName(0))
  await userEvent.click(screen.getByRole('button', { name: 'Создать сервер' }))
  expect(await screen.findByText('Введите название роли.')).toBeInTheDocument()
  expect(calls.filter((call) => call.method !== 'GET')).toEqual([])
})

// «Далее» checks only its own step: an error left on a later step must not
// hold back an earlier one, where it cannot be seen.
it('checks each step on its own', async () => {
  stubApi()
  renderWizard()
  await toRolesStep()
  await userEvent.clear(roleName(0))
  await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
  await userEvent.click(screen.getByRole('button', { name: 'Назад' }))

  await next()
  expect(
    await screen.findByRole('heading', { name: 'С каких каналов начать?' }),
  ).toBeInTheDocument()
  await next()
  expect(await screen.findByRole('heading', { name: 'Кто что может?' })).toBeInTheDocument()
})

it('stops at the name the server would refuse, counting characters like it', async () => {
  const calls = stubApi()
  renderWizard()

  // 64 emoji are 128 UTF-16 units but 64 characters: the server takes them.
  const field = screen.getByLabelText('Название сервера')
  fireEvent.change(field, { target: { value: '🚀'.repeat(65) } })
  await next()
  expect(await screen.findByText('Название — не больше 64 символов.')).toBeInTheDocument()

  fireEvent.change(field, { target: { value: '🚀'.repeat(64) } })
  await next()
  expect(
    await screen.findByRole('heading', { name: 'С каких каналов начать?' }),
  ).toBeInTheDocument()
  expect(calls.filter((call) => call.method !== 'GET')).toEqual([])
})

it('opens the server anyway when a role fails, and says which', async () => {
  stubApi({
    'POST /api/v1/workspaces/:id/roles': [500, { error: { code: 'internal', message: 'x' } }],
  })
  renderWizard()
  await toRolesStep()
  await userEvent.click(screen.getByRole('button', { name: 'Создать сервер' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'не создались роли «Администратор», «Модератор» — их можно добавить в настройках сервера',
  )
})
