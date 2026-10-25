/**
 * The dialogues muted before FEAT-5 lived in `localStorage`. The server owns
 * them now; this reads the old list once so the account can carry its choices
 * over, and removes the key so the move happens only once per device.
 */
const STORAGE_KEY = 'orbit.notifications.muted-conversations'

/** The ids the old device kept muted, emptied from storage. */
export const takeLegacyConversationMutes = (): string[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)
    if (stored === null) {
      return []
    }
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    // Storage can be off (private mode, blocked cookies): there is nothing to move.
    return []
  }
}
