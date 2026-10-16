import { createFakePlatform } from '@/shared/lib/test'

import { getPlatform, setPlatform } from './platform'

afterEach(() => {
  setPlatform(null)
})

describe('getPlatform', () => {
  it('defaults to the browser adapter and keeps one instance', () => {
    const platform = getPlatform()

    expect(platform.autostart.isSupported()).toBe(false)
    expect(getPlatform()).toBe(platform)
  })

  it('returns the adapter installed instead, until reset', () => {
    const fake = createFakePlatform()
    fake.autostart.isSupported.mockReturnValue(true)

    setPlatform(fake)
    expect(getPlatform()).toBe(fake)
    expect(getPlatform().autostart.isSupported()).toBe(true)

    setPlatform(null)
    expect(getPlatform()).not.toBe(fake)
    expect(getPlatform().autostart.isSupported()).toBe(false)
  })
})
