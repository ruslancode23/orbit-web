import { createBrowserRouter } from 'react-router'

import { HomePage } from '@/pages/home'
import { LoginPage } from '@/pages/login'
import { RegisterPage } from '@/pages/register'
import { PageLoader } from '@/shared/ui/page-loader'

import { RequireSession } from './RequireSession'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: <RequireSession />,
    children: [{ path: '/', element: <HomePage /> }],
  },
  {
    // Still open: the voice room runs on the development token endpoint, which
    // knows nothing about accounts yet. It moves behind the session together
    // with the app shell (task 2.12).
    path: '/room/:roomId',
    HydrateFallback: PageLoader,
    lazy: async () => {
      const { RoomPage } = await import('@/pages/room')
      return { Component: RoomPage }
    },
  },
])
