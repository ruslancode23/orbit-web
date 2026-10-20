import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { MessageCard } from './MessageCard'

import type { Message } from '../model/message'

const messageId = '11111111-1111-4111-8111-111111111111'
const anna = {
  id: 'u-anna',
  nickname: 'Anna',
  displayName: 'Anna',
  accentColor: 'slate' as const,
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-10-18T10:00:00Z'),
}

const makeMessage = (overrides: Partial<Message> = {}): Message => {
  return {
    id: messageId,
    channelId: '22222222-2222-4222-8222-222222222222',
    seq: 1n,
    content: 'привет',
    author: anna,
    mentions: [],
    reactions: [],
    createdAt: new Date('2026-10-18T10:00:00Z'),
    ...overrides,
  }
}

it('marks the mention of the reader in the text', () => {
  renderWithProviders(
    <MessageCard
      message={makeMessage({ content: '@Anna привет' })}
      startsGroup
      mentionsMe
      myNickname="Anna"
    />,
    { route: '/' },
  )

  expect(screen.getByText('@Anna').tagName).toBe('MARK')
})

it('leaves the text alone when the message mentions someone else', () => {
  renderWithProviders(
    <MessageCard
      message={makeMessage({ content: '@Anna привет' })}
      startsGroup
      myNickname="Anna"
    />,
    { route: '/' },
  )

  expect(screen.getByText('@Anna привет').tagName).toBe('P')
})

it('shows a reply preview and jumps to the message it answers', async () => {
  const original = makeMessage({ content: 'исходное' })
  const onJumpTo = vi.fn()
  renderWithProviders(
    <MessageCard
      message={makeMessage({ content: 'ответ', replyToId: original.id })}
      startsGroup
      replyTo={original}
      onJumpTo={onJumpTo}
    />,
    { route: '/' },
  )

  await userEvent.click(screen.getByRole('button', { name: 'Перейти к сообщению от Anna' }))

  expect(onJumpTo).toHaveBeenCalledWith(original.id)
})

it('says a message was edited or deleted', () => {
  const { rerender } = renderWithProviders(
    <MessageCard message={makeMessage({ editedAt: new Date() })} startsGroup />,
    { route: '/' },
  )
  expect(screen.getByText('(изменено)')).toBeInTheDocument()

  rerender(
    <MessageCard
      message={makeMessage({ content: '', deletedAt: new Date('2026-10-18T11:00:00Z') })}
      startsGroup
    />,
  )
  expect(screen.getByText('Сообщение удалено')).toBeInTheDocument()
})
