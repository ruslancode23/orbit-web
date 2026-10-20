/**
 * Which microphone and speakers the person picked. The ids are remembered on
 * this device; a missing device is not forgotten, so plugging it back in picks
 * it up again. `undefined` means the system default.
 */
export interface DevicePreferences {
  microphoneId?: string
  speakerId?: string
}

const MICROPHONE_KEY = 'orbit.devices.microphone'
const SPEAKER_KEY = 'orbit.devices.speaker'

const read = (key: string): string | undefined => {
  try {
    return localStorage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

const write = (key: string, value: string | undefined): void => {
  try {
    if (value === undefined) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // Storage blocked: the choice lives for this page only.
  }
}

export const readDevicePreferences = (): DevicePreferences => {
  return {
    microphoneId: read(MICROPHONE_KEY),
    speakerId: read(SPEAKER_KEY),
  }
}

export const saveMicrophoneId = (deviceId: string | undefined): void => {
  write(MICROPHONE_KEY, deviceId)
}

export const saveSpeakerId = (deviceId: string | undefined): void => {
  write(SPEAKER_KEY, deviceId)
}
