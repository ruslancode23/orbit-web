import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { VoiceChannelMembers } from './VoiceChannelMembers'

import type { VoiceChannelMember } from '../model/members'

const member = (id: string, overrides: Partial<VoiceChannelMember> = {}): VoiceChannelMember => ({
  id,
  name: `Участник ${id}`,
  muted: false,
  deafened: false,
  screenSharing: false,
  speaking: false,
  ...overrides,
})

// These rows ask for the profile only when the member list has not already
// brought one; here nobody shares a server with the test, so it is a 404.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { code: 'not_found', message: 'no profile' } }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('shows nothing for an empty channel', () => {
  renderWithProviders(<VoiceChannelMembers channelName="room" members={[]} />, { route: '/' })

  expect(screen.queryByRole('list', { name: 'Участники канала room' })).not.toBeInTheDocument()
})

it('shows the voice state of each participant', () => {
  renderWithProviders(
    <VoiceChannelMembers
      channelName="room"
      members={[
        member('1', { muted: true }),
        member('2', { deafened: true }),
        member('3', { screenSharing: true }),
      ]}
    />,
    { route: '/' },
  )

  const list = screen.getByRole('list', { name: 'Участники канала room' })
  expect(list).toHaveTextContent('микрофон выключен')
  expect(list).toHaveTextContent('звук выключен')
  expect(list).toHaveTextContent('показывает экран')
})

it('collapses a long list to eight people and expands it back', async () => {
  const members = Array.from({ length: 10 }, (_, index) => member(String(index)))
  renderWithProviders(<VoiceChannelMembers channelName="room" members={members} />, { route: '/' })

  const list = screen.getByRole('list', { name: 'Участники канала room' })
  expect(list.querySelectorAll('li')).toHaveLength(8)
  await userEvent.click(screen.getByRole('button', { name: '+2' }))
  expect(list.querySelectorAll('li')).toHaveLength(10)
  await userEvent.click(screen.getByRole('button', { name: 'Свернуть' }))
  expect(list.querySelectorAll('li')).toHaveLength(8)
})
