/** What a server icon may be; the server reads the type from the bytes and agrees. */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

/** Why a picked file will not do, before anything is sent. */
export type ImageFileProblem = 'type' | 'size'

export function checkImageFile(file: Blob, maxBytes: number): ImageFileProblem | null {
  if (!IMAGE_TYPES.some((type) => type === file.type)) {
    return 'type'
  }
  if (file.size > maxBytes) {
    return 'size'
  }
  return null
}

/** «2 МБ», for the hints next to a file field. */
export function formatMegabytes(bytes: number): string {
  const value = bytes / (1024 * 1024)
  return `${value.toLocaleString('ru', { maximumFractionDigits: 1 })} МБ`
}
