import type { Role, WorkspaceMember, WorkspaceMembership } from '@/shared/api'

import { mayBan, mayKick } from './moderation'
import { outranks, rankOf } from './roles'
import { can, hasPermission } from './workspace'

const membership = (
  role: WorkspaceMembership['role'],
  permissions?: WorkspaceMembership['permissions'],
): WorkspaceMembership => ({
  workspace: {
    id: 'w-1',
    name: 'Сервер',
    description: null,
    iconUrl: null,
    ownerId: 'u-owner',
    createdAt: new Date(),
    memberPermissions: { canInvite: false, canCreateChannels: true, canAttachFiles: true },
  },
  role,
  ...(permissions === undefined ? {} : { permissions }),
})

const member = (
  id: string,
  role: WorkspaceMember['role'],
  roleIds: string[] = [],
): WorkspaceMember => ({
  user: {
    id,
    nickname: id,
    displayName: '',
    accentColor: 'slate',
    bio: '',
    isGuest: false,
    createdAt: new Date(),
  },
  role,
  joinedAt: new Date(),
  roleIds,
})

const roles: Role[] = [
  {
    id: 'r-admin',
    name: 'Администратор',
    hoist: true,
    position: 2,
    permissions: ['administrator'],
    isDefault: false,
  },
  {
    id: 'r-mod',
    name: 'Модератор',
    hoist: true,
    position: 1,
    permissions: ['kickMembers'],
    isDefault: false,
  },
  {
    id: 'r-everyone',
    name: '@everyone',
    hoist: false,
    position: 0,
    permissions: ['viewChannel'],
    isDefault: true,
  },
]

it('reads permissions from the server and falls back to the old roles without them', () => {
  const moderator = membership('member', ['viewChannel', 'kickMembers'])
  expect(hasPermission(moderator, 'kickMembers')).toBe(true)
  expect(hasPermission(moderator, 'banMembers')).toBe(false)
  expect(hasPermission(membership('member', ['administrator']), 'banMembers')).toBe(true)
  // An older server sends no permissions: the owner and admins may do everything.
  expect(hasPermission(membership('admin'), 'manageServer')).toBe(true)
  expect(hasPermission(membership('member'), 'manageServer')).toBe(false)
  expect(hasPermission(undefined, 'viewChannel')).toBe(false)
})

it('answers the old member flags from the permissions behind them', () => {
  expect(can(membership('member', ['manageChannels']), 'canCreateChannels')).toBe(true)
  expect(can(membership('member', ['viewChannel']), 'canCreateChannels')).toBe(false)
  expect(can(membership('member', ['createInvite']), 'canInvite')).toBe(true)
  // Without permissions, the server's flags decide for a member.
  expect(can(membership('member'), 'canCreateChannels')).toBe(true)
  expect(can(membership('member'), 'canInvite')).toBe(false)
})

it('ranks members by their highest role and puts the owner above everyone', () => {
  const owner = member('u-owner', 'owner')
  const admin = member('u-admin', 'admin', ['r-admin'])
  const moderator = member('u-mod', 'member', ['r-mod'])
  const plain = member('u-plain', 'member')

  expect(rankOf(owner, roles)).toBe(Number.POSITIVE_INFINITY)
  expect(rankOf(admin, roles)).toBe(2)
  expect(rankOf(plain, roles)).toBe(0)
  expect(outranks(admin, moderator, roles)).toBe(true)
  expect(outranks(moderator, admin, roles)).toBe(false)
  expect(outranks(moderator, member('u-mod-2', 'member', ['r-mod']), roles)).toBe(false)
  expect(outranks(owner, owner, roles)).toBe(false)
})

it('offers kicking and banning only with the permission and a rank above', () => {
  const me = member('u-mod', 'member', ['r-mod'])
  const standing = { membership: membership('member', ['kickMembers']), me, roles }

  expect(mayKick(standing, member('u-plain', 'member'))).toBe(true)
  expect(mayBan(standing, member('u-plain', 'member'))).toBe(false)
  expect(mayKick(standing, member('u-admin', 'admin', ['r-admin']))).toBe(false)
  expect(mayKick(standing, me)).toBe(false)
})
