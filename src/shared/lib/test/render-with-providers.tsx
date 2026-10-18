import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import type { ReactElement, ReactNode } from 'react'

interface Options extends RenderOptions {
  /**
   * Where the router starts. Pass it for a component with links or redirects;
   * leave it out when the test brings its own router.
   */
  route?: string
  queryClient?: QueryClient
}

/** Renders with the providers the app has: a QueryClient without retries and a router. */
export function renderWithProviders(
  ui: ReactElement,
  { route, queryClient, ...options }: Options = {},
) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

  function Providers({ children }: { children: ReactNode }) {
    const content =
      route === undefined ? (
        children
      ) : (
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      )
    return <QueryClientProvider client={client}>{content}</QueryClientProvider>
  }
  return { queryClient: client, ...render(ui, { wrapper: Providers, ...options }) }
}
