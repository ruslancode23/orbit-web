import { screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'

import { renderWithProviders } from '@/shared/lib/test'

import RoomPage from './RoomPage'

const renderAt = (path: string) => {
  const router = createMemoryRouter([{ path: '/room/:roomId', element: <RoomPage /> }], {
    initialEntries: [path],
  })
  return renderWithProviders(<RouterProvider router={router} />)
}

describe('RoomPage', () => {
  it('offers to join a valid room', () => {
    renderAt('/room/dev-room')

    expect(screen.getByRole('heading', { name: /Комната dev-room/ })).toBeInTheDocument()
  })

  it('rejects a room name the server would not accept', () => {
    renderAt('/room/%D0%BA%D0%BE%D0%BC%D0%BD%D0%B0%D1%82%D0%B0')

    expect(screen.getByRole('alert')).toHaveTextContent('Такой комнаты не бывает')
  })
})
