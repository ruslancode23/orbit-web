import { atLeast, can, type WorkspaceMembership, type WorkspaceRole } from './workspace'

const membership = (
  role: WorkspaceRole,
  memberPermissions = { canInvite: false, canCreateChannels: false, canAttachFiles: true },
): WorkspaceMembership => ({
  role,
  workspace: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Команда',
    description: null,
    iconUrl: null,
    memberPermissions,
    ownerId: 'u1',
    createdAt: new Date('2026-10-20T10:00:00Z'),
  },
})

it('ranks the roles as the server does', () => {
  expect(atLeast('owner', 'admin')).toBe(true)
  expect(atLeast('member', 'admin')).toBe(false)
  expect(atLeast(undefined, 'member')).toBe(false)
})

it('lets admins and the owner do everything, whatever the flags say', () => {
  const none = { canInvite: false, canCreateChannels: false, canAttachFiles: false }
  for (const role of ['admin', 'owner'] as const) {
    expect(can(membership(role, none), 'canInvite')).toBe(true)
    expect(can(membership(role, none), 'canCreateChannels')).toBe(true)
    expect(can(membership(role, none), 'canAttachFiles')).toBe(true)
  }
})

it('lets a member do what the server allows', () => {
  const member = membership('member')

  expect(can(member, 'canInvite')).toBe(false)
  expect(can(member, 'canCreateChannels')).toBe(false)
  expect(can(member, 'canAttachFiles')).toBe(true)
  expect(
    can(
      membership('member', { ...member.workspace.memberPermissions, canInvite: true }),
      'canInvite',
    ),
  ).toBe(true)
  expect(can(undefined, 'canAttachFiles')).toBe(false)
})
