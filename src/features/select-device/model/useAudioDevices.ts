import { useCallback, useEffect, useState } from 'react'

import { getPlatform } from '@/shared/platform'

/** The value a select or menu uses for "let the system decide". */
export const DEFAULT_DEVICE = 'default'

interface DeviceLists {
  /** The version of the list these devices answer for. */
  version: number
  microphones: MediaDeviceInfo[]
  speakers: MediaDeviceInfo[]
}

interface AudioDevicesValue {
  microphones: MediaDeviceInfo[]
  speakers: MediaDeviceInfo[]
  /** True until the list for the current version arrives. */
  loading: boolean
  /** Labels stay empty until the microphone was allowed at least once. */
  labelsVisible: boolean
  /** Whether the browser can send sound to a chosen speaker. */
  canSelectOutput: boolean
  refresh: () => void
  /** Asks for the microphone so labels appear; resolves whether it was granted. */
  requestAccess: () => Promise<boolean>
}

/**
 * Microphones and speakers as the platform reports them, refreshed when a
 * device is plugged in or removed. Only the adapter touches `enumerateDevices`
 * and `devicechange`; the UI just reads this list.
 */
export const useAudioDevices = (): AudioDevicesValue => {
  const platform = getPlatform()
  const [lists, setLists] = useState<DeviceLists | undefined>(undefined)
  const [version, setVersion] = useState(0)

  const refresh = useCallback(() => {
    setVersion((current) => current + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      platform.mediaDevices.list('audioinput'),
      platform.mediaDevices.list('audiooutput'),
    ])
      .then(([inputs, outputs]) => {
        if (cancelled) {
          return
        }
        setLists({
          version,
          microphones: inputs.filter((device) => device.deviceId !== ''),
          speakers: outputs.filter((device) => device.deviceId !== ''),
        })
      })
      .catch(() => {
        if (!cancelled) {
          setLists({ version, microphones: [], speakers: [] })
        }
      })
    return () => {
      cancelled = true
    }
  }, [platform, version])

  useEffect(() => {
    return platform.mediaDevices.onChange(() => {
      setVersion((current) => current + 1)
    })
  }, [platform])

  const requestAccess = useCallback(async () => {
    const granted = await platform.mediaDevices.requestAccess().catch(() => false)
    refresh()
    return granted
  }, [platform, refresh])

  const microphones = lists?.version === version ? lists.microphones : []
  const speakers = lists?.version === version ? lists.speakers : []

  return {
    microphones,
    speakers,
    loading: lists?.version !== version,
    labelsVisible: [...microphones, ...speakers].some((device) => device.label !== ''),
    canSelectOutput: platform.mediaDevices.canSelectOutput(),
    refresh,
    requestAccess,
  }
}

/** The name to show for a device: the system one, or a numbered stand-in before access. */
export const deviceLabel = (device: MediaDeviceInfo, index: number): string => {
  return device.label !== '' ? device.label : `Устройство ${String(index + 1)}`
}
