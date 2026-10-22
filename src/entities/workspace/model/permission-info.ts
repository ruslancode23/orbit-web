import type { Permission } from '@/shared/api'

export interface PermissionInfo {
  permission: Permission
  title: string
  hint: string
  /** Whether a channel may change it for a role (an override). */
  channel: boolean
}

/** What each permission means, in the order the settings show them. */
export const PERMISSION_GROUPS: readonly { title: string; items: readonly PermissionInfo[] }[] = [
  {
    title: 'Сервер',
    items: [
      {
        permission: 'administrator',
        title: 'Администратор',
        hint: 'Все права сразу; закрытые каналы открыты. Давайте только тем, кому доверяете как себе.',
        channel: false,
      },
      {
        permission: 'manageServer',
        title: 'Управлять сервером',
        hint: 'Название, описание, иконка, права всех участников и список приглашений.',
        channel: false,
      },
      {
        permission: 'manageRoles',
        title: 'Управлять ролями',
        hint: 'Создавать и менять роли ниже своей и выдавать их участникам.',
        channel: false,
      },
      {
        permission: 'manageChannels',
        title: 'Управлять каналами',
        hint: 'Создавать, менять, удалять и переставлять каналы, менять права в них.',
        channel: true,
      },
      {
        permission: 'createChannels',
        title: 'Создавать каналы',
        hint: 'Только создавать новые каналы.',
        channel: false,
      },
    ],
  },
  {
    title: 'Модерация',
    items: [
      {
        permission: 'kickMembers',
        title: 'Исключать участников',
        hint: 'Тех, чья высшая роль ниже вашей.',
        channel: false,
      },
      {
        permission: 'banMembers',
        title: 'Банить участников',
        hint: 'Тех, чья высшая роль ниже вашей; забаненный не вернётся по ссылке.',
        channel: false,
      },
      {
        permission: 'manageMessages',
        title: 'Удалять чужие сообщения',
        hint: 'В каналах, которые видны.',
        channel: true,
      },
    ],
  },
  {
    title: 'Участие',
    items: [
      {
        permission: 'viewChannel',
        title: 'Видеть каналы',
        hint: 'Без этого права каналы скрыты целиком, вместе с историей.',
        channel: true,
      },
      {
        permission: 'sendMessages',
        title: 'Писать сообщения',
        hint: 'В текстовых каналах.',
        channel: true,
      },
      {
        permission: 'speak',
        title: 'Говорить в голосе',
        hint: 'В голосовых каналах; без права можно только слушать.',
        channel: true,
      },
      {
        permission: 'attachFiles',
        title: 'Прикреплять файлы',
        hint: 'Файлы и изображения в сообщениях.',
        channel: true,
      },
      {
        permission: 'createInvite',
        title: 'Приглашать людей',
        hint: 'Создавать ссылки-приглашения.',
        channel: true,
      },
    ],
  },
]

/** Every permission with its meaning, in settings order. */
export const PERMISSIONS: readonly PermissionInfo[] = PERMISSION_GROUPS.flatMap(
  (group) => group.items,
)
