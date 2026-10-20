import { Suspense, lazy } from 'react'

import { PageLoader } from '@/shared/ui/page-loader'

// libolm, its worker and the wasm are fetched only when a secret chat opens.
const SecretChatPage = lazy(() => import('@/pages/secret-chat'))

export const SecretChatRoute = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <SecretChatPage />
    </Suspense>
  )
}
