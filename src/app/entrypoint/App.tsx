import { QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { RouterProvider } from 'react-router'

import { LiveProvider } from '@/entities/live'
import { useSession } from '@/entities/session'
import { createQueryClient } from '@/shared/api'

import { router } from '../routes/router'

export function App() {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <LiveLayer>
        <RouterProvider router={router} />
      </LiveLayer>
    </QueryClientProvider>
  )
}

/** Holds the live stream above the routes, and only while someone is signed in. */
function LiveLayer({ children }: { children: ReactNode }) {
  const { isSignedIn } = useSession()
  return <LiveProvider enabled={isSignedIn}>{children}</LiveProvider>
}
