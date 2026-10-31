import { deepLinkPath } from './deep-link'

describe('deep link paths', () => {
  it('turns an invite link into the invite route', () => {
    expect(deepLinkPath('orbit://invite/abc123')).toBe('/invite/abc123')
    expect(deepLinkPath('orbit://invite/abc123/')).toBe('/invite/abc123')
  })

  it('refuses anything that is not an invitation', () => {
    for (const url of [
      'orbit://s/workspace/channel',
      'orbit://invite',
      'https://orbit.invalid/invite/abc',
      'orbit://invite/a/b',
      'not a url',
    ]) {
      expect(deepLinkPath(url)).toBeNull()
    }
  })
})
