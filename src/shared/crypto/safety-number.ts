import { createHashLike } from './sha512'

import type { OlmIdentity } from './olm'

/** Signal-style: 30 emoji in a grid, 60 digits in 12 groups, and a QR payload. */
export interface SafetyNumber {
  emoji: string[]
  groups: string[]
  digits: string
  /** What the QR code encodes; both devices show the same string. */
  qr: string
}

/** 64 emoji, so one hash byte picks one without a modulo bias table. */
export const SAFETY_EMOJI = [
  '🐶',
  '🐱',
  '🦊',
  '🐻',
  '🐼',
  '🐨',
  '🐯',
  '🦁',
  '🐮',
  '🐷',
  '🐸',
  '🐵',
  '🐔',
  '🐧',
  '🦉',
  '🦄',
  '🐝',
  '🦋',
  '🐌',
  '🐞',
  '🐢',
  '🐍',
  '🐙',
  '🦑',
  '🦀',
  '🐬',
  '🐳',
  '🐟',
  '🐠',
  '🦈',
  '🐊',
  '🦓',
  '🦒',
  '🐘',
  '🦏',
  '🐪',
  '🐫',
  '🦘',
  '🐄',
  '🐎',
  '🐖',
  '🐓',
  '🦃',
  '🕊️',
  '🐕',
  '🐈',
  '🐇',
  '🦝',
  '🌵',
  '🌲',
  '🌳',
  '🌴',
  '🌱',
  '🌿',
  '🍀',
  '🍁',
  '🍄',
  '🌾',
  '🌺',
  '🌻',
  '🌹',
  '🌷',
  '🌼',
  '🌸',
] as const

const groupCount = 12
const emojiCount = 30

/**
 * A code both devices compute from the same four public keys. It is a
 * fingerprint, not a secret: its only use is comparing it out loud or scanning
 * it in person, which is what defeats a server substituting keys.
 */
export const calculateSafetyNumber = async (
  mine: OlmIdentity,
  theirs: OlmIdentity,
): Promise<SafetyNumber> => {
  // Sorting makes both sides compute the same string whichever one asks.
  const sides = [
    `${mine.identityKey}|${mine.signingKey}`,
    `${theirs.identityKey}|${theirs.signingKey}`,
  ].sort()
  const digest = await createHashLike('SHA-512', `orbit-safety-number-v1|${sides.join('|')}`)
  const view = new DataView(digest.buffer, digest.byteOffset, digest.byteLength)

  const groups: string[] = []
  for (let i = 0; i < groupCount; i += 1) {
    // The last groups reuse the beginning of the digest: 12 groups need 48 bytes
    // and SHA-512 has 64, so no reuse happens in practice.
    const offset = i * 4
    const value = view.getUint32(offset, false) % 100_000
    groups.push(String(value).padStart(5, '0'))
  }

  const emoji: string[] = []
  for (let i = 0; i < emojiCount; i += 1) {
    const byte = digest[i % digest.length] ?? 0
    const pick = SAFETY_EMOJI[byte % SAFETY_EMOJI.length]
    if (pick) {
      emoji.push(pick)
    }
  }

  const digits = groups.join('')
  return { emoji, groups, digits, qr: `orbit:v1:${digits}` }
}
