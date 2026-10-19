/**
 * What did not work out after the server itself was created. It travels to
 * the new server in the router's location state, so the server opens anyway
 * and says what to finish in its settings.
 */
export interface CreationProblems {
  iconFailed: boolean
  failedChannels: string[]
}

export interface CreationState {
  creationProblems: CreationProblems
}

export function isCreationState(state: unknown): state is CreationState {
  if (typeof state !== 'object' || state === null || !('creationProblems' in state)) {
    return false
  }
  const { creationProblems } = state
  return (
    typeof creationProblems === 'object' &&
    creationProblems !== null &&
    'iconFailed' in creationProblems &&
    typeof creationProblems.iconFailed === 'boolean' &&
    'failedChannels' in creationProblems &&
    Array.isArray(creationProblems.failedChannels) &&
    creationProblems.failedChannels.every((name) => typeof name === 'string')
  )
}
