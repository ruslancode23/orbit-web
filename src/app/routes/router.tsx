import { createBrowserRouter } from 'react-router'

import AboutBetaPage from '@/pages/about-beta'
import DirectPage from '@/pages/direct'
import InvitePage from '@/pages/invite'
import LoginPage from '@/pages/login'
import NewWorkspacePage from '@/pages/new-workspace'
import RegisterPage from '@/pages/register'
import ChannelPage from '@/pages/workspace'
import WorkspaceSettingsPage from '@/pages/workspace-settings'
import { AppShell, ShellPlaceholder } from '@/widgets/app-shell'

import { LegacyDirectRedirect } from './LegacyDirectRedirect'
import { RequireSession } from './RequireSession'
import { SecretChatRoute } from './SecretChatRoute'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  // Open: someone deciding whether to join reads it before having an account.
  { path: '/beta', element: <AboutBetaPage /> },
  // Open on purpose: the link shows what it leads to before asking for a name.
  { path: '/invite/:code', element: <InvitePage /> },
  {
    element: <RequireSession />,
    children: [
      {
        // The shell holds the one live connection, so switching servers and
        // channels inside it never opens a second socket.
        element: <AppShell />,
        children: [
          { path: '/', element: <ShellPlaceholder /> },
          { path: '/new', element: <NewWorkspacePage /> },
          // Personal messages and secret chats live outside any server. A
          // fixed segment outranks `:conversationId`, so `/me/friends` opens
          // the friends section and is never read as a dialogue id.
          { path: '/me', element: <DirectPage /> },
          { path: '/me/friends', element: <DirectPage /> },
          { path: '/me/:conversationId', element: <DirectPage /> },
          { path: '/me/s/:secretChatId', element: <SecretChatRoute /> },
          // The section was `/dm` before; keep the old links working.
          { path: '/dm/*', element: <LegacyDirectRedirect /> },
          { path: '/s/:workspaceId', element: <ShellPlaceholder /> },
          // A fixed segment outranks `:channelId`, so this is never read as a channel.
          { path: '/s/:workspaceId/settings', element: <WorkspaceSettingsPage /> },
          { path: '/s/:workspaceId/:channelId', element: <ChannelPage /> },
        ],
      },
    ],
  },
])
