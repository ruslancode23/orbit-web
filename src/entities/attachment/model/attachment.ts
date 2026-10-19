import { useQuery } from '@tanstack/react-query'

import { type Attachment, getAttachmentLinkOptions } from '@/shared/api'

export type { Attachment }

/** Ask for a new link this long before the old one stops working. */
const LINK_MARGIN_MS = 60_000
/** Previews fit this box; the full size is one click away. */
const PREVIEW_MAX = { width: 360, height: 280 }

/** The server reads the type from the file's first bytes, so this is what it is, not what it claims. */
export function isImage(attachment: Attachment): boolean {
  return attachment.mimeType.startsWith('image/')
}

/** «512 Б», «1,4 КБ», «25 МБ» — sizes as people read them. */
export function formatSize(bytes: number | bigint): string {
  const value = Number(bytes)
  const units = ['Б', 'КБ', 'МБ', 'ГБ']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  const digits = unit === 0 || size >= 10 ? 0 : 1
  return `${size.toLocaleString('ru', { maximumFractionDigits: digits })} ${units[unit] ?? ''}`
}

/**
 * The size an image preview takes, known before the image loads: the list is
 * virtualized and measures rows, so a preview that grew on load would make it jump.
 */
export function previewSize(attachment: Attachment): { width: number; height: number } {
  const { width, height } = attachment
  if (!width || !height) {
    return { width: PREVIEW_MAX.width, height: PREVIEW_MAX.height / 2 }
  }
  const scale = Math.min(1, PREVIEW_MAX.width / width, PREVIEW_MAX.height / height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

const untilRenewal = (expiresAt: Date | undefined): number =>
  expiresAt ? Math.max(expiresAt.getTime() - Date.now() - LINK_MARGIN_MS, 0) : 0

/**
 * A short-lived signed link to the file, straight from the object store. It is
 * renewed shortly before it expires, so a link on screen keeps working.
 */
export function useAttachmentLink(attachmentId: string) {
  return useQuery({
    ...getAttachmentLinkOptions({ path: { attachmentId } }),
    staleTime: (query) => untilRenewal(query.state.data?.expiresAt),
    refetchInterval: (query) => {
      const delay = untilRenewal(query.state.data?.expiresAt)
      return delay > 0 ? delay : false
    },
  })
}
