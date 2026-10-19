import type { WorkspacePermissions } from './workspace'

/** The same limits the server keeps (`Workspace` in the API spec). */
export const NAME_MAX = 64
export const DESCRIPTION_MAX = 500
/** The largest icon the server takes (`ORBIT_MAX_ICON_BYTES`, 2 MiB by default). */
export const ICON_MAX_BYTES = 2 * 1024 * 1024
/**
 * The largest picture one may pick. It is cropped and re-encoded to a small
 * square before upload, so a phone photo over the icon limit still fits.
 */
export const ICON_SOURCE_MAX_BYTES = 10 * 1024 * 1024
/** Width and height of the uploaded icon, in pixels. */
export const ICON_SIZE = 256

/** What a new server lets its members do, as the server itself defaults. */
export const DEFAULT_MEMBER_PERMISSIONS: WorkspacePermissions = {
  canInvite: false,
  canCreateChannels: false,
  canAttachFiles: true,
}

/** What happens to the icon when the form is sent. */
export type WorkspaceIconChange =
  { kind: 'keep' } | { kind: 'set'; file: Blob; previewUrl: string } | { kind: 'remove' }

/** Name, description and icon: the server's profile, on creation and in settings. */
export interface WorkspaceProfileValues {
  name: string
  description: string
  icon: WorkspaceIconChange
}

export type MemberPermissionValues = WorkspacePermissions
