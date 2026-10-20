import { useState, useSyncExternalStore } from 'react'

import { getPlatform } from '@/shared/platform'
import { Button } from '@/shared/ui/button'

/**
 * Offers the browser's install prompt while it is available. The prompt is a
 * one-shot event, so the button follows the adapter's store instead of keeping
 * a copy: after the person accepts or dismisses, the browser takes it away.
 */
export const InstallApp = () => {
  const platformInstall = getPlatform().install
  const canPrompt = useSyncExternalStore(platformInstall.onChange, platformInstall.canPrompt)
  const installed = useSyncExternalStore(platformInstall.onChange, platformInstall.isInstalled)
  const [failed, setFailed] = useState(false)

  if (!platformInstall.isSupported() || installed || !canPrompt) {
    return null
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setFailed(false)
          void platformInstall.prompt().catch(() => {
            setFailed(true)
          })
        }}
      >
        Установить приложение
      </Button>
      {failed && (
        <p role="alert" className="text-xs text-danger">
          Браузер не смог открыть установку.
        </p>
      )}
    </div>
  )
}
