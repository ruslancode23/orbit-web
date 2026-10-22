import type { Permission } from '@/entities/workspace'
import type { Accent } from '@/shared/lib/accent'

export type StarterRoleId = 'admin' | 'moderator'

export interface StarterRole {
  id: StarterRoleId
  name: string
  hint: string
  color: Accent
  permissions: Permission[]
}

/** The longest role name the server takes, in characters. */
export const ROLE_NAME_MAX = 32

export const ADMIN_ROLE: StarterRole = {
  id: 'admin',
  name: 'Администратор',
  hint: 'Может всё, кроме действий над владельцем.',
  color: 'red',
  permissions: ['administrator'],
}

export const MODERATOR_ROLE: StarterRole = {
  id: 'moderator',
  name: 'Модератор',
  hint: 'Исключает, банит и удаляет чужие сообщения.',
  color: 'teal',
  permissions: ['kickMembers', 'banMembers', 'manageMessages'],
}

/**
 * Roles a new server may start with, highest first: they are created in this
 * order, and each new role lands right above @everyone, below the ones before.
 * Both are shown apart in the member column.
 */
export const STARTER_ROLES: readonly StarterRole[] = [ADMIN_ROLE, MODERATOR_ROLE]
