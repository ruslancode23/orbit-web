import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import {
  createPushSubscriptionMutation,
  deletePushSubscription,
  getPushConfigOptions,
} from '@/shared/api'
import { getPlatform } from '@/shared/platform'

/**
 * The id the server gave this browser's subscription. It is how the browser
 * unsubscribes later — at «off» and at sign-out — without knowing its endpoint
 * on the server's side.
 */
const SUBSCRIPTION_ID_KEY = 'orbit.push.subscription-id'

const readId = (): string | null => {
  try {
    return localStorage.getItem(SUBSCRIPTION_ID_KEY)
  } catch {
    return null
  }
}

const writeId = (id: string | null): void => {
  try {
    if (id === null) {
      localStorage.removeItem(SUBSCRIPTION_ID_KEY)
    } else {
      localStorage.setItem(SUBSCRIPTION_ID_KEY, id)
    }
  } catch {
    // Without storage the subscription still works; it just cannot be removed from here later.
  }
}

/**
 * Where push stands on this device:
 * `unsupported` — no service worker or Push API (dev build, old browser, iOS outside the home screen);
 * `server-off` — the server has no VAPID keys; `denied` — the browser refused notifications.
 */
export type PushState = 'loading' | 'unsupported' | 'server-off' | 'denied' | 'off' | 'on'

/**
 * Stops pushes to this browser: the server forgets the subscription, then the
 * browser drops it. Called at sign-out while the session still works; a failure
 * leaves a subscription the server drops itself on the next 404/410.
 */
export const forgetPushOnThisDevice = async (): Promise<void> => {
  const id = readId()
  writeId(null)
  if (id !== null) {
    await deletePushSubscription({ path: { subscriptionId: id } }).catch(() => undefined)
  }
  await getPlatform()
    .push.unsubscribe()
    .catch(() => undefined)
}

export const usePushSubscription = () => {
  const config = useQuery(getPushConfigOptions())
  const [supported, setSupported] = useState<boolean | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [denied, setDenied] = useState(() => getPlatform().notifications.permission() === 'denied')
  const save = useMutation(createPushSubscriptionMutation())

  useEffect(() => {
    let cancelled = false
    const platform = getPlatform()
    void platform.push
      .isSupported()
      .catch(() => false)
      .then(async (ok) => ({
        ok,
        current: ok ? await platform.push.current().catch(() => null) : null,
      }))
      .then(({ ok, current }) => {
        if (cancelled) {
          return
        }
        setSupported(ok)
        // Subscribed in the browser and known to the server from here.
        setSubscribed(current !== null && readId() !== null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const state: PushState =
    supported === null || config.isPending
      ? 'loading'
      : !supported
        ? 'unsupported'
        : config.data?.enabled !== true || config.data.publicKey === undefined
          ? 'server-off'
          : subscribed
            ? 'on'
            : denied
              ? 'denied'
              : 'off'

  const enable = async (): Promise<void> => {
    const key = config.data?.publicKey
    if (key === undefined) {
      return
    }
    const platform = getPlatform()
    // Asked only here, from the switch: never on page load.
    let permission = platform.notifications.permission()
    if (permission === 'default') {
      permission = await platform.notifications.requestPermission()
    }
    if (permission !== 'granted') {
      setDenied(permission === 'denied')
      return
    }
    const subscription = await platform.push.subscribe(key)
    const saved = await save.mutateAsync({ body: subscription })
    writeId(saved.id)
    setSubscribed(true)
  }

  const disable = async (): Promise<void> => {
    await forgetPushOnThisDevice()
    setSubscribed(false)
  }

  return { state, enable, disable, pending: save.isPending }
}
