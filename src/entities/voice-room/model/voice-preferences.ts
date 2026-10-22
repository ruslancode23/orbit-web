/**
 * How the microphone is captured: the browser's own processing. Each one is on
 * by default, as in LiveKit; a studio microphone or a music stream may want them off.
 */
export interface AudioProcessing {
  noiseSuppression: boolean
  echoCancellation: boolean
  autoGainControl: boolean
}

export const DEFAULT_AUDIO_PROCESSING: AudioProcessing = {
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
}

const PROCESSING_KEYS: Record<keyof AudioProcessing, string> = {
  noiseSuppression: 'orbit.voice.noise-suppression',
  echoCancellation: 'orbit.voice.echo-cancellation',
  autoGainControl: 'orbit.voice.auto-gain-control',
}

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    // Storage can be blocked; the defaults then stand.
    return null
  }
}

const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // The choice works for this page, it just is not remembered.
  }
}

/** Chosen on this device; anything never chosen keeps the default. */
export const readAudioProcessing = (): AudioProcessing => {
  const flag = (name: keyof AudioProcessing) => {
    const stored = read(PROCESSING_KEYS[name])
    return stored === null ? DEFAULT_AUDIO_PROCESSING[name] : stored === 'true'
  }
  return {
    noiseSuppression: flag('noiseSuppression'),
    echoCancellation: flag('echoCancellation'),
    autoGainControl: flag('autoGainControl'),
  }
}

export const saveAudioProcessing = (processing: AudioProcessing): void => {
  for (const name of Object.keys(PROCESSING_KEYS) as (keyof AudioProcessing)[]) {
    write(PROCESSING_KEYS[name], String(processing[name]))
  }
}

/**
 * `standard` is the browser's own suppression; `enhanced` is RNNoise on top of
 * the raw microphone (the browser's is then off, so the voice is not processed twice).
 */
export type NoiseSuppressionMode = 'off' | 'standard' | 'enhanced'

const ENHANCED_NOISE_SUPPRESSION_KEY = 'orbit.voice.enhanced-noise-suppression'

export const readEnhancedNoiseSuppression = (): boolean => {
  return read(ENHANCED_NOISE_SUPPRESSION_KEY) === 'true'
}

export const saveEnhancedNoiseSuppression = (enhanced: boolean): void => {
  write(ENHANCED_NOISE_SUPPRESSION_KEY, String(enhanced))
}

export const noiseSuppressionMode = (
  processing: AudioProcessing,
  enhanced: boolean,
): NoiseSuppressionMode => {
  if (!processing.noiseSuppression) {
    return 'off'
  }
  return enhanced ? 'enhanced' : 'standard'
}

/** What goes to getUserMedia: with RNNoise on, the browser's own suppression is off. */
export const captureConstraints = (
  processing: AudioProcessing,
  enhanced: boolean,
): AudioProcessing => {
  return { ...processing, noiseSuppression: processing.noiseSuppression && !enhanced }
}

/**
 * `voice-activity` sends the microphone whenever it hears something; with
 * `push-to-talk` it is open only while a key (or the panel button) is held.
 */
export type InputMode = 'voice-activity' | 'push-to-talk'

/** `KeyboardEvent.code` of the backtick key: under Esc, unused while typing elsewhere, the same on any layout. */
export const DEFAULT_PUSH_TO_TALK_KEY = 'Backquote'

const INPUT_MODE_KEY = 'orbit.voice.input-mode'
const PUSH_TO_TALK_KEY = 'orbit.voice.push-to-talk-key'

export const readInputMode = (): InputMode => {
  return read(INPUT_MODE_KEY) === 'push-to-talk' ? 'push-to-talk' : 'voice-activity'
}

export const saveInputMode = (mode: InputMode): void => {
  write(INPUT_MODE_KEY, mode)
}

export const readPushToTalkKey = (): string => {
  return read(PUSH_TO_TALK_KEY) ?? DEFAULT_PUSH_TO_TALK_KEY
}

export const savePushToTalkKey = (code: string): void => {
  write(PUSH_TO_TALK_KEY, code)
}
