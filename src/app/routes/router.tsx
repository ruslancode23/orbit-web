import { createBrowserRouter } from 'react-router'

import { LoginPage } from '@/pages/login'
import { RegisterPage } from '@/pages/register'
import { ChannelPage } from '@/pages/workspace'
import { PageLoader } from '@/shared/ui/page-loader'
import { AppShell } from '@/widgets/app-shell'

import { RequireSession } from './RequireSession'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: <RequireSession />,
    children: [
      {
        // The shell holds the one live connection, so switching servers and
        // channels inside it never opens a second socket.
        element: <AppShell />,
        children: [
          { path: '/', element: null },
          { path: '/s/:workspaceId', element: null },
          { path: '/s/:workspaceId/:channelId', element: <ChannelPage /> },
        ],
      },
    ],
  },
  {
    // Still open: the voice room runs on the development token endpoint, which
    // knows nothing about accounts yet (task 2.12 note in AGENTS.md).
    path: '/room/:roomId',
    HydrateFallback: PageLoader,
    lazy: async () => {
      const { RoomPage } = await import('@/pages/room')
      return { Component: RoomPage }
    },
  },
])
