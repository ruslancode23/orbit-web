import type { DmPolicy, FriendshipPolicy } from '@/shared/api'
import { isApiError } from '@/shared/api'

export interface PolicyOption<T extends string> {
  value: T
  label: string
  description: string
}

/**
 * Who may start a dialogue. `friends` is a real setting on this server: a
 * friendship outlives the common server the two people met on.
 */
export const DM_POLICY_OPTIONS: readonly PolicyOption<DmPolicy>[] = [
  {
    value: 'shared',
    label: 'Люди с общих серверов',
    description: 'Диалог может начать любой, с кем вы вместе состоите на сервере.',
  },
  {
    value: 'friends',
    label: 'Только друзья',
    description: 'Новый диалог может начать только человек из ваших друзей.',
  },
  {
    value: 'nobody',
    label: 'Никто',
    description: 'Новые диалоги закрыты; в уже начатых переписках писать можно.',
  },
]

/** Who may send a friendship request; a block outranks every value. */
export const FRIEND_REQUEST_POLICY_OPTIONS: readonly PolicyOption<FriendshipPolicy>[] = [
  {
    value: 'all',
    label: 'Все',
    description: 'Заявку может отправить любой аккаунт, кроме гостей.',
  },
  {
    value: 'shared',
    label: 'Люди с общих серверов',
    description: 'Заявку может отправить тот, с кем вы вместе состоите на сервере.',
  },
  {
    value: 'nobody',
    label: 'Никто',
    description: 'Заявки в друзья закрыты.',
  },
]

/** The sentence under a setting the server refused: never an English server code. */
export const describePrivacyError = (error: unknown): string => {
  if (isApiError(error) && error.isNetworkError) {
    return 'Нет соединения с сервером. Настройка не сохранена.'
  }
  return 'Не удалось сохранить настройку. Попробуйте ещё раз.'
}
