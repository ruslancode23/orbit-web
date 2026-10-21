import { isApiError } from '@/shared/api'

/**
 * The sentence a failed group action shows. A direct dialogue answers 409 to
 * every group-only method: it cannot grow into a group and cannot be renamed,
 * so the UI names the way out instead of repeating a server code.
 */
export const describeConversationError = (
  error: unknown,
  fallback = 'Не получилось выполнить действие.',
): string => {
  if (!isApiError(error)) {
    return fallback
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (error.status === 409) {
    // The same status covers a group that is already full; the server's words
    // are the only thing that separates the two, so they pick the sentence.
    if (/too many people/iu.test(error.message)) {
      return 'В группе уже слишком много участников.'
    }
    return 'Это личный диалог, создайте группу.'
  }
  if (error.status === 404) {
    return 'Беседа не найдена или вы больше не её участник.'
  }
  if (error.status === 403) {
    return 'Недостаточно прав для этого действия.'
  }
  if (error.status === 400) {
    return 'Проверьте название: оно должно быть от 1 до 100 символов.'
  }
  return fallback
}
