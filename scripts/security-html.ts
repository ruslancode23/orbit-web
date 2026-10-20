/**
 * Content-Security-Policy for the built app. Third-party scripts are absent, so
 * `script-src 'self'`; WASM needs `'wasm-unsafe-eval'` and nothing more. The API
 * origin is allowed explicitly when it is not the app's own.
 */
export function contentSecurityPolicy(apiOrigin?: string): string {
  const connect = new Set(["'self'", 'ws:', 'wss:', 'https:'])
  if (apiOrigin) {
    connect.add(apiOrigin)
    connect.add(apiOrigin.replace(/^http/, 'ws'))
  }
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    `connect-src ${[...connect].join(' ')}`,
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

/** WebCrypto, so this module also runs in the Vitest jsdom project. */
const sha384 = async (source: string | Uint8Array): Promise<string> => {
  const encoded = typeof source === 'string' ? new TextEncoder().encode(source) : source
  const bytes = new Uint8Array(new ArrayBuffer(encoded.length))
  bytes.set(encoded)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-384', bytes))
  let binary = ''
  for (const byte of digest) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

/** SRI hashes the emitted chunk, not what the browser will download later. */
export const integrityOf = async (source: string | Uint8Array): Promise<string> =>
  `sha384-${await sha384(source)}`

/**
 * Adds a CSP meta tag and `integrity` to the scripts and styles the build
 * emitted. A tag whose file is not in the bundle is left alone: it is either
 * external or inline, and neither gets a made-up hash.
 */
export async function secureHtml(
  html: string,
  bundle: Record<string, { source?: string | Uint8Array; code?: string }> | undefined,
  apiOrigin?: string,
): Promise<string> {
  const byName: Record<string, { source?: string | Uint8Array; code?: string } | undefined> =
    bundle ?? {}
  let secured = html
  for (const [file, asset] of Object.entries(byName)) {
    // A JS chunk carries `code`; a copied asset carries `source`.
    const content = asset?.source ?? asset?.code
    if (content === undefined) {
      continue
    }
    const integrity = await integrityOf(content)
    const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`<(script|link)([^>]*?)(src|href)="/${escaped}"([^>]*)>`, 'g')
    secured = secured.replace(
      pattern,
      (tag: string, element: string, before: string, attribute: string, after: string) => {
        if (tag.includes('integrity=')) {
          return tag
        }
        return `<${element}${before}${attribute}="/${file}"${after} integrity="${integrity}" crossorigin="anonymous">`
      },
    )
  }
  const csp = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(apiOrigin)}">`
  return secured.replace('</head>', `  ${csp}\n  </head>`)
}
