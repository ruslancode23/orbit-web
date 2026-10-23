import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import { getPlatform } from '@/shared/platform'

/**
 * A click on a push notification focuses this window and the service worker
 * tells it where to go; the app routes there without reloading.
 */
export const usePushNotificationOpen = (): void => {
  const navigate = useNavigate()

  useEffect(
    () =>
      getPlatform().push.onOpen((path) => {
        void navigate(path)
      }),
    [navigate],
  )
}
