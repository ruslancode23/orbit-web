import { createBrowserRouter } from 'react-router'

import { HomePage } from '@/pages/home'
import { PageLoader } from '@/shared/ui/page-loader'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    // Loaded on demand: the room page brings livekit-client with it.
    path: '/room/:roomId',
    HydrateFallback: PageLoader,
    lazy: async () => {
      const { RoomPage } = await import('@/pages/room')
      return { Component: RoomPage }
    },
  },
])
