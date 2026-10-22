import { isApiError } from '@/shared/api'

/** A refusal of the roles API in plain words. */
export const describeRoleError = (error: unknown): string => {
  if (!isApiError(error)) {
    return 'Не получилось изменить роли. Попробуйте ещё раз.'
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (error.status === 403) {
    return 'Не хватает прав: можно менять только роли ниже своей и давать только свои права.'
  }
  if (error.status === 404) {
    return 'Роль уже удалена.'
  }
  if (error.status === 400) {
    if (/name/iu.test(error.message)) {
      return 'Название роли — от 1 до 32 символов.'
    }
    if (/@everyone/iu.test(error.message)) {
      return 'У @everyone меняются только права.'
    }
    return 'Сервер не принял изменение.'
  }
  return 'Не получилось изменить роли. Попробуйте ещё раз.'
}
