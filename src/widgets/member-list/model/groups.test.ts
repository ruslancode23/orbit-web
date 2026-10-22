import type { Role, WorkspaceMember } from '@/entities/workspace'

import { groupMembers } from './groups'

const member = (nickname: string, roleIds: string[] = []): WorkspaceMember => ({
  user: {
    id: `u-${nickname}`,
    nickname,
    displayName: '',
    accentColor: 'slate',
    bio: '',
    isGuest: false,
    createdAt: new Date('2026-10-18T10:00:00Z'),
  },
  role: 'member',
  joinedAt: new Date('2026-10-18T10:00:00Z'),
  roleIds,
})

const role = (id: string, name: string, position: number, hoist: boolean): Role => ({
  id,
  name,
  hoist,
  position,
  permissions: [],
  isDefault: false,
})

// Highest first, as the server sends them.
const roles: Role[] = [
  role('r-admin', 'Админы', 3, true),
  role('r-quiet', 'Тихие', 2, false),
  role('r-mod', 'Модераторы', 1, true),
  { ...role('r-everyone', '@everyone', 0, false), isDefault: true },
]

it('puts each member under their highest role shown apart, the rest last', () => {
  const groups = groupMembers(
    [
      member('vika'),
      member('boris', ['r-mod']),
      member('anna', ['r-admin', 'r-mod']),
      // A role not shown apart does not make a group of its own.
      member('gleb', ['r-quiet', 'r-mod']),
      member('dina', ['r-quiet']),
    ],
    roles,
  )

  expect(groups.map((group) => [group.title, group.rows.map((row) => row.user.nickname)])).toEqual([
    ['Админы', ['anna']],
    ['Модераторы', ['boris', 'gleb']],
    ['Участники', ['dina', 'vika']],
  ])
})

it('puts everyone together while the roles are unknown', () => {
  const groups = groupMembers([member('boris', ['r-mod']), member('anna')], undefined)

  expect(groups.map((group) => group.title)).toEqual(['Участники'])
  expect(groups[0]?.rows.map((row) => row.user.nickname)).toEqual(['anna', 'boris'])
})
