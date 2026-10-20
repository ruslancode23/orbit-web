import { QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { RouterProvider } from 'react-router'

import { LiveProvider } from '@/entities/live'
import { useSession } from '@/entities/session'
import { createQueryClient } from '@/shared/api'
import { ToastProvider } from '@/shared/ui/toast'

import { router } from '../routes/router'

export const App = () => {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <LiveLayer>
          <RouterProvider router={router} />
        </LiveLayer>
      </ToastProvider>
    </QueryClientProvider>
  )
}

/** Holds the live stream above the routes, and only while someone is signed in. */
const LiveLayer = ({ children }: { children: ReactNode }) => {
  const { isSignedIn } = useSession()
  return <LiveProvider enabled={isSignedIn}>{children}</LiveProvider>
}
