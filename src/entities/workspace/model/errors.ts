import { isApiError } from '@/shared/api'

/** A field of the profile form an answer of the server is about. */
export type WorkspaceField = 'name' | 'description' | 'icon'

export interface WorkspaceErrorText {
  /** Where to show it; none means the form as a whole. */
  field?: WorkspaceField
  message: string
}

/**
 * Turns a refusal into words and the field they belong to. The server names
 * the field only in its English message, so that is what decides between the
 * name and the description; the name is the safe guess.
 */
export function describeWorkspaceError(error: unknown, fallback: string): WorkspaceErrorText {
  if (!isApiError(error)) {
    return { message: fallback }
  }
  if (error.isNetworkError) {
    return { message: 'Нет соединения с сервером.' }
  }
  if (error.status === 403) {
    return { message: 'Для этого нужны права администратора.' }
  }
  if (error.status === 415) {
    return { field: 'icon', message: 'Подойдёт только изображение PNG, JPEG или WebP.' }
  }
  if (error.status === 413) {
    return error.message.includes('icon')
      ? { field: 'icon', message: 'Изображение слишком большое.' }
      : { field: 'description', message: 'Описание слишком длинное.' }
  }
  if (error.status === 400) {
    if (error.message.includes('description')) {
      return { field: 'description', message: 'Описание — не больше 500 символов.' }
    }
    if (error.message.includes('name')) {
      return { field: 'name', message: 'Название — от 1 до 64 символов.' }
    }
  }
  return { message: fallback }
}
