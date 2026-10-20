/**
 * What the name helpers need. The generated `UserProfile` and a conversation
 * member both fit it; `displayName` is optional here because a row can be drawn
 * from a payload that predates profiles, before the server sends the full one.
 */
export interface NamedProfile {
  nickname: string
  displayName?: string | null
}

/** The name people see; the unique handle stands in until a display name is set. */
export const userDisplayName = (profile: NamedProfile): string => {
  return (profile.displayName ?? '').trim() || profile.nickname
}

/** The accessible name of an avatar: the display name, or the handle when there is none. */
export const userLabel = (profile: NamedProfile): string => {
  return (profile.displayName ?? '').trim() || `@${profile.nickname}`
}
