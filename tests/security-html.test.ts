import { contentSecurityPolicy, integrityOf, secureHtml } from '../scripts/security-html.ts'

describe('built page security', () => {
  it('hashes the emitted script and adds it to the tag', async () => {
    const bundle = {
      'assets/app-abc.js': { source: 'console.log("hi")' },
      'assets/app-abc.css': { source: 'body{color:red}' },
    }
    const html =
      '<head></head><body><script type="module" crossorigin src="/assets/app-abc.js"></script><link rel="stylesheet" href="/assets/app-abc.css"></body>'

    const secured = await secureHtml(html, bundle, undefined)

    expect(secured).toContain(`integrity="${await integrityOf('console.log("hi")')}"`)
    expect(secured).toContain(`integrity="${await integrityOf('body{color:red}')}"`)
    expect(secured).toContain('crossorigin="anonymous"')
    expect(secured).toContain('Content-Security-Policy')
  })

  it('leaves a tag without a bundled file alone', async () => {
    const html = '<script src="https://cdn.example/app.js"></script>'
    expect(await secureHtml(html, {}, undefined)).toBe(html)
  })

  it('allows only the API origin besides self in connect-src', () => {
    const policy = contentSecurityPolicy('https://api.orbit.example')
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'")
    expect(policy).not.toContain("'unsafe-eval'")
    expect(policy).toContain('https://api.orbit.example')
    expect(policy).toContain('wss://api.orbit.example')
    expect(policy).toContain("object-src 'none'")
  })
})
