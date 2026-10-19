export interface SquareImage {
  blob: Blob
  /** For showing the result straight away; nothing to revoke later. */
  dataUrl: string
}

/**
 * Draws one square of an image into a new picture `size` pixels wide. WebP
 * where the browser can write it, PNG otherwise (Safari) — both are fine for
 * the server.
 */
export async function renderSquare(
  image: CanvasImageSource,
  square: { x: number; y: number; size: number },
  size: number,
): Promise<SquareImage> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is not available')
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, square.x, square.y, square.size, square.size, 0, 0, size, size)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.9)
  })
  if (!blob) throw new Error('The image could not be encoded')
  return { blob, dataUrl: canvas.toDataURL(blob.type) }
}
