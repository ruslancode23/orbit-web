import {
  DEFAULT_SCREEN_SHARE_QUALITY,
  screenContentHint,
  screenVideoConstraints,
  type ScreenShareQuality,
} from './screen-quality'

const CASES: readonly {
  resolution: ScreenShareQuality['resolution']
  frameRate: ScreenShareQuality['frameRate']
  width: number
  height: number
}[] = [
  { resolution: '720p', frameRate: 30, width: 1280, height: 720 },
  { resolution: '720p', frameRate: 60, width: 1280, height: 720 },
  { resolution: '1080p', frameRate: 30, width: 1920, height: 1080 },
  { resolution: '1080p', frameRate: 60, width: 1920, height: 1080 },
]

describe('screen share quality', () => {
  it('keeps the old capture of 1080p at 30 fps unless something else is chosen', () => {
    expect(DEFAULT_SCREEN_SHARE_QUALITY).toEqual({ resolution: '1080p', frameRate: 30 })
    expect(screenVideoConstraints(DEFAULT_SCREEN_SHARE_QUALITY)).toEqual({
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: 30,
    })
  })

  it.each(CASES)(
    'asks for $resolution at $frameRate fps',
    ({ resolution, frameRate, width, height }) => {
      expect(screenVideoConstraints({ resolution, frameRate })).toEqual({
        width: { ideal: width },
        height: { ideal: height },
        frameRate,
      })
    },
  )

  it('hints motion for 60 fps and detail for 30 fps', () => {
    expect(screenContentHint(60)).toBe('motion')
    expect(screenContentHint(30)).toBe('detail')
  })
})
