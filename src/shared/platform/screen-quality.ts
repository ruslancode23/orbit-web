/**
 * What the screen share asks the browser for (SCRUM-147). The cap keeps an
 * uncapped 4K screen from encoding slowly and dropping the bitrate, as in
 * livekit-client's own `ScreenSharePresets.h1080fps30`.
 */
export interface ScreenShareQuality {
  resolution: '720p' | '1080p'
  frameRate: 30 | 60
}

/** The old hard-coded capture: 1080p at 30 fps, so an unchanged setting behaves as before. */
export const DEFAULT_SCREEN_SHARE_QUALITY: ScreenShareQuality = {
  resolution: '1080p',
  frameRate: 30,
}

const RESOLUTIONS = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
} as const satisfies Record<ScreenShareQuality['resolution'], { width: number; height: number }>

/** What `getDisplayMedia` is asked for: the size and frame rate are ideals, not limits. */
export const screenVideoConstraints = (quality: ScreenShareQuality): MediaTrackConstraints => {
  const { width, height } = RESOLUTIONS[quality.resolution]
  return {
    width: { ideal: width },
    height: { ideal: height },
    frameRate: quality.frameRate,
  }
}

/**
 * The encoder hint: moving pictures want smoothness, text and slides want
 * sharpness. Browsers that do not know it ignore the hint.
 */
export const screenContentHint = (
  frameRate: ScreenShareQuality['frameRate'],
): 'detail' | 'motion' => {
  return frameRate === 60 ? 'motion' : 'detail'
}
