import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { useSession } from '@/entities/session'
import type { SelfProfile } from '@/shared/api'
import { renderWithProviders } from '@/shared/lib/test'

import { ProfileOnboarding } from './ProfileOnboarding'
import { resetProfileOnboarding } from '../model/onboarding'

const anna: SelfProfile = {
  id: 'u-anna',
  nickname: 'anna',
  displayName: 'anna',
  accentColor: 'violet',
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-10-18T10:00:00Z'),
  profileOnboardedAt: null,
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

interface StubOptions {
  profile?: SelfProfile
  onboardingStatus?: number
  profileStatus?: number
}

/** Answers the session, the onboarding mark and the profile PATCH. */
const stubApi = ({
  profile = anna,
  onboardingStatus = 204,
  profileStatus = 200,
}: StubOptions = {}) => {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      calls.push({
        method: request.method,
        path: url.pathname,
        body: request.method === 'PATCH' ? await request.clone().json() : undefined,
      })
      if (url.pathname === '/api/v1/auth/me') {
        return json(profile)
      }
      if (url.pathname === '/api/v1/users/me/onboarding') {
        return onboardingStatus === 204
          ? new Response(null, { status: 204 })
          : json({ error: { code: 'forbidden', message: 'guest' } }, onboardingStatus)
      }
      if (url.pathname === '/api/v1/users/me/profile' && request.method === 'PATCH') {
        if (profileStatus !== 200) {
          return json({ error: { code: 'invalid', message: 'bio' } }, profileStatus)
        }
        return json({ ...profile, displayName: 'Анна' })
      }
      return json({})
    }),
  )
  return calls
}

/** Shows that the session has arrived, so "no dialog" cannot pass too early. */
const SessionProbe = () => {
  const { user, isLoading } = useSession()
  return <span>{isLoading ? 'загрузка' : user?.nickname}</span>
}

const renderStep = () => {
  return renderWithProviders(
    <>
      <ProfileOnboarding />
      <SessionProbe />
    </>,
    { route: '/' },
  )
}

const step = () => screen.queryByRole('dialog', { name: 'Заполните профиль' })

afterEach(() => {
  resetProfileOnboarding()
  vi.unstubAllGlobals()
})

it('shows the step while the server says it is not passed', async () => {
  stubApi()
  renderStep()

  expect(await screen.findByRole('dialog', { name: 'Заполните профиль' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Пропустить' })).toBeInTheDocument()
})

it('does not show the step once the server has a passing date', async () => {
  stubApi({ profile: { ...anna, profileOnboardedAt: new Date('2026-10-20T12:00:00Z') } })
  renderStep()

  await waitFor(() => {
    expect(screen.getByText('anna')).toBeInTheDocument()
  })
  expect(step()).not.toBeInTheDocument()
})

it('does not show the profile form to a guest', async () => {
  stubApi({ profile: { ...anna, isGuest: true } })
  renderStep()

  await waitFor(() => {
    expect(screen.getByText('anna')).toBeInTheDocument()
  })
  expect(step()).not.toBeInTheDocument()
})

it('marks the step when it is skipped', async () => {
  const calls = stubApi()
  renderStep()

  const dialog = await screen.findByRole('dialog', { name: 'Заполните профиль' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Пропустить' }))

  await waitFor(() => {
    expect(step()).not.toBeInTheDocument()
  })
  expect(calls.some((call) => call.path === '/api/v1/users/me/onboarding')).toBe(true)
})

it('saves the profile first and then marks the step', async () => {
  const calls = stubApi()
  renderStep()

  const dialog = await screen.findByRole('dialog', { name: 'Заполните профиль' })
  await userEvent.type(within(dialog).getByLabelText('Отображаемое имя'), ' Анна')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

  await waitFor(() => {
    expect(step()).not.toBeInTheDocument()
  })
  const paths = calls.map((call) => call.path)
  expect(paths).toContain('/api/v1/users/me/profile')
  expect(paths.indexOf('/api/v1/users/me/profile')).toBeLessThan(
    paths.indexOf('/api/v1/users/me/onboarding'),
  )
})

it('marks the step even when the profile was left untouched', async () => {
  const calls = stubApi()
  renderStep()

  const dialog = await screen.findByRole('dialog', { name: 'Заполните профиль' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

  await waitFor(() => {
    expect(step()).not.toBeInTheDocument()
  })
  expect(calls.some((call) => call.path === '/api/v1/users/me/profile')).toBe(false)
  expect(calls.some((call) => call.path === '/api/v1/users/me/onboarding')).toBe(true)
})

it('keeps the step and does not mark it when the profile is refused', async () => {
  const calls = stubApi({ profileStatus: 400 })
  renderStep()

  const dialog = await screen.findByRole('dialog', { name: 'Заполните профиль' })
  await userEvent.type(within(dialog).getByLabelText('Отображаемое имя'), ' Анна')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

  expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
  expect(step()).toBeInTheDocument()
  expect(calls.some((call) => call.path === '/api/v1/users/me/onboarding')).toBe(false)
})

it('does not break when the server refuses the mark as a guest', async () => {
  stubApi({ onboardingStatus: 403 })
  renderStep()

  const dialog = await screen.findByRole('dialog', { name: 'Заполните профиль' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Пропустить' }))

  await waitFor(() => {
    expect(step()).not.toBeInTheDocument()
  })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('stays closed for this page session after Esc, without marking it passed', async () => {
  const calls = stubApi()
  const view = renderStep()

  const dialog = await screen.findByRole('dialog', { name: 'Заполните профиль' })
  within(dialog).getByLabelText('Отображаемое имя').focus()
  await userEvent.keyboard('{Escape}')
  await waitFor(() => {
    expect(step()).not.toBeInTheDocument()
  })
  expect(calls.some((call) => call.path === '/api/v1/users/me/onboarding')).toBe(false)

  // Navigating away and back mounts the shell again: the step stays away in
  // this page session, and only a reload asks the server again.
  view.unmount()
  renderStep()
  await waitFor(() => {
    expect(screen.getByText('anna')).toBeInTheDocument()
  })
  expect(step()).not.toBeInTheDocument()
})
