import { render, screen } from '@testing-library/react'

import { ParticipantCard } from './ParticipantCard'

import type { Participant } from '../model/participant'

const bob: Participant = {
  identity: 'guest-bob',
  name: 'Bob',
  isLocal: false,
  isSpeaking: false,
  isMicrophoneMuted: false,
  isDeafened: false,
}

describe('ParticipantCard', () => {
  it('shows the name, and marks the local participant', () => {
    const { rerender } = render(<ParticipantCard participant={bob} />)
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.queryByText('(вы)')).not.toBeInTheDocument()

    rerender(<ParticipantCard participant={{ ...bob, isLocal: true }} />)
    expect(screen.getByText('(вы)')).toBeInTheDocument()
  })

  it('tells screen readers who is speaking and who is muted or deafened', () => {
    const { container, rerender } = render(
      <ParticipantCard participant={{ ...bob, isSpeaking: true }} />,
    )
    expect(container.firstChild).toHaveAttribute('data-speaking', 'true')
    expect(container).toHaveTextContent('Bob, говорит')

    rerender(<ParticipantCard participant={{ ...bob, isMicrophoneMuted: true }} />)
    expect(container.firstChild).toHaveAttribute('data-speaking', 'false')
    expect(container).toHaveTextContent('Bob, микрофон выключен')

    rerender(
      <ParticipantCard participant={{ ...bob, isMicrophoneMuted: true, isDeafened: true }} />,
    )
    expect(container).toHaveTextContent('Bob, звук выключен')
  })

  it('renders controls passed as children', () => {
    render(
      <ParticipantCard participant={bob}>
        <button type="button">Громкость</button>
      </ParticipantCard>,
    )

    expect(screen.getByRole('button', { name: 'Громкость' })).toBeInTheDocument()
  })
})
