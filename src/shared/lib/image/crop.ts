export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/**
 * Where an image sits in a square frame it fully covers. `zoom` 1 fits the
 * shorter side to the frame; `offset` moves the image centre from the frame
 * centre, in frame pixels, and is kept so that no empty edge shows.
 */
export interface CoverLayout {
  /** Frame pixels per image pixel. */
  scale: number
  width: number
  height: number
  left: number
  top: number
  offset: Point
}

export function coverLayout(image: Size, frame: number, zoom: number, offset: Point): CoverLayout {
  const scale = (frame / Math.min(image.width, image.height)) * Math.max(zoom, 1)
  const width = image.width * scale
  const height = image.height * scale
  const clamped = {
    x: clamp(offset.x, (width - frame) / 2),
    y: clamp(offset.y, (height - frame) / 2),
  }
  return {
    scale,
    width,
    height,
    left: frame / 2 + clamped.x - width / 2,
    top: frame / 2 + clamped.y - height / 2,
    offset: clamped,
  }
}

/** The square of the image, in its own pixels, that the frame shows. */
export function visibleSquare(layout: CoverLayout, frame: number) {
  return {
    // `+ 0` turns -0 into 0: the same pixel either way, but tidier to read.
    x: -layout.left / layout.scale + 0,
    y: -layout.top / layout.scale + 0,
    size: frame / layout.scale,
  }
}

const clamp = (value: number, limit: number) => Math.min(Math.max(value, -limit), limit) + 0
