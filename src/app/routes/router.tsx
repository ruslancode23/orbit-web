import { createBrowserRouter } from 'react-router'

import { HomePage } from '@/pages/home'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    // Loaded on demand: the room page brings livekit-client with it.
    path: '/room/:roomId',
    lazy: async () => {
      const { RoomPage } = await import('@/pages/room')
      return { Component: RoomPage }
    },
  },
])
