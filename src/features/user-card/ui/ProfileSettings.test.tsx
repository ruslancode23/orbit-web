import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { getUserProfileQueryKey, type ProfileUpdate, type UserProfile } from '@/shared/api'
import type * as ImageModule from '@/shared/lib/image'
import { renderWithProviders } from '@/shared/lib/test'

import { ProfileSettings } from './ProfileSettings'

// jsdom has no canvas: the drawing itself is the browser's part.
vi.mock('@/shared/lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof ImageModule>()),
  renderSquare: vi.fn(() =>
    Promise.resolve({ blob: new Blob(['x'], { type: 'image/webp' }), dataUrl: 'data:,cropped' }),
  ),
}))

const me: UserProfile = {
  id: 'u-me',
  nickname: 'anna',
  displayName: 'Анна',
  accentColor: 'violet',
  bio: 'Пишу код и пью кофе.',
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
  form?: FormData
}

const stubProfileApi = (start: UserProfile = me) => {
  let profile = start
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      if (url.pathname === '/api/v1/users/me/profile' && request.method === 'PATCH') {
        const body = (await request.clone().json()) as ProfileUpdate
        calls.push({ method: 'PATCH', path: url.pathname, body })
        profile = { ...profile, ...body }
        return json(profile)
      }
      if (url.pathname === '/api/v1/users/me/avatar' && request.method === 'PUT') {
        calls.push({
          method: 'PUT',
          path: url.pathname,
          form: await request.clone().formData(),
        })
        profile = { ...profile, avatarUrl: 'https://files.test/avatar.webp' }
        return json(profile)
      }
      if (url.pathname === '/api/v1/users/me/avatar' && request.method === 'DELETE') {
        calls.push({ method: 'DELETE', path: url.pathname })
        const rest = { ...profile }
        delete rest.avatarUrl
        profile = rest
        return json(profile)
      }
      return json({ error: { code: 'not_found', message: 'no' } }, 404)
    }),
  )
  return {
    calls,
    current: () => profile,
  }
}

const renderSettings = (profile: UserProfile = me) =>
  renderWithProviders(<ProfileSettings profile={profile} />)

const form = () => screen.getByRole('form', { name: 'Профиль' })
const saveButton = () => within(form()).getByRole('button', { name: 'Сохранить' })
const preview = () => screen.getByRole('region', { name: 'Предпросмотр профиля' })

const loadCroppedImage = () => {
  const dialog = screen.getByRole('dialog', { name: 'Обрезка аватара' })
  const image = dialog.querySelector('button img')
  if (!(image instanceof HTMLImageElement)) {
    throw new Error('no image')
  }
  Object.defineProperty(image, 'naturalWidth', { value: 300 })
  Object.defineProperty(image, 'naturalHeight', { value: 300 })
  fireEvent.load(image)
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:picked')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('saves the text fields and shows them in the live card', async () => {
  const api = stubProfileApi()
  const { queryClient } = renderSettings()

  await userEvent.clear(within(form()).getByLabelText('Отображаемое имя'))
  await userEvent.type(within(form()).getByLabelText('Отображаемое имя'), 'Анна П.')
  await userEvent.clear(within(form()).getByLabelText('О себе'))
  await userEvent.type(within(form()).getByLabelText('О себе'), 'Люблю короткие встречи.')
  await userEvent.click(within(form()).getByRole('button', { name: 'Розовый' }))

  expect(within(preview()).getByText('Анна П.')).toBeInTheDocument()
  expect(within(preview()).getByText('Люблю короткие встречи.')).toBeInTheDocument()

  await userEvent.click(saveButton())

  await waitFor(() => {
    expect(api.calls).toEqual([
      {
        method: 'PATCH',
        path: '/api/v1/users/me/profile',
        body: {
          displayName: 'Анна П.',
          bio: 'Люблю короткие встречи.',
          accentColor: 'pink',
        },
      },
    ])
  })
  expect(await screen.findByText('Профиль сохранён')).toBeInTheDocument()
  expect(
    queryClient.getQueryData(getUserProfileQueryKey({ path: { userId: me.id } })),
  ).toMatchObject({ displayName: 'Анна П.', bio: 'Люблю короткие встречи.', accentColor: 'pink' })
  expect(saveButton()).toBeDisabled()
})

it('counts the bio and refuses more than the limit before sending', async () => {
  const api = stubProfileApi()
  renderSettings()
  const bio = within(form()).getByLabelText('О себе')

  expect(bio).toHaveAttribute('maxlength', '190')
  expect(within(form()).getByText('20 / 190')).toHaveAttribute('aria-live', 'polite')

  fireEvent.change(bio, { target: { value: 'я'.repeat(191) } })

  expect(within(form()).getByText('191 / 190')).toBeInTheDocument()
  await userEvent.click(saveButton())

  expect(await screen.findByText('Не больше 190 символов.')).toBeInTheDocument()
  expect(api.calls).toHaveLength(0)
})

it('paints the preview with the chosen accent and marks the swatch', async () => {
  stubProfileApi()
  renderSettings()

  const pink = within(form()).getByRole('button', { name: 'Розовый' })
  await userEvent.click(pink)

  expect(pink).toHaveAttribute('aria-pressed', 'true')
  const initials = within(preview()).getByRole('img', { name: 'Анна' })
  expect(initials.className).toContain('bg-profile-pink')
})

it('uploads a cropped avatar and shows it in the preview', async () => {
  const api = stubProfileApi()
  const { queryClient } = renderSettings()

  await userEvent.upload(
    within(form()).getByLabelText('Файл аватара'),
    new File([new Uint8Array(16)], 'me.png', { type: 'image/png' }),
  )
  loadCroppedImage()
  await userEvent.click(
    within(screen.getByRole('dialog', { name: 'Обрезка аватара' })).getByRole('button', {
      name: 'Применить',
    }),
  )

  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Обрезка аватара' })).not.toBeInTheDocument()
  })
  expect(within(preview()).getByRole('img', { name: 'Анна' })).toHaveAttribute(
    'src',
    'data:,cropped',
  )

  await userEvent.click(saveButton())

  await waitFor(() => {
    expect(api.calls.some((call) => call.method === 'PUT')).toBe(true)
  })
  const upload = api.calls.find((call) => call.method === 'PUT')
  expect(upload?.form?.get('file')).toMatchObject({ type: 'image/webp', size: 1 })
  expect(await screen.findByText('Профиль сохранён')).toBeInTheDocument()
  expect(
    queryClient.getQueryData(getUserProfileQueryKey({ path: { userId: me.id } })),
  ).toMatchObject({ avatarUrl: 'https://files.test/avatar.webp' })
})

it('removes the current avatar', async () => {
  const api = stubProfileApi({ ...me, avatarUrl: 'https://files.test/old.webp' })
  renderSettings({ ...me, avatarUrl: 'https://files.test/old.webp' })

  await userEvent.click(within(form()).getByRole('button', { name: 'Удалить аватар' }))
  expect(within(preview()).queryByRole('img', { name: 'Анна' })).toBeInTheDocument()
  expect(within(form()).getByRole('button', { name: 'Загрузить аватар' })).toBeInTheDocument()

  await userEvent.click(saveButton())

  await waitFor(() => {
    expect(api.calls).toEqual([{ method: 'DELETE', path: '/api/v1/users/me/avatar' }])
  })
  expect(await screen.findByText('Профиль сохранён')).toBeInTheDocument()
})
