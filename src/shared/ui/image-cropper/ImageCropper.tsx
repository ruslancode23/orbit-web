import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

import { cn } from '@/shared/lib/cn'
import {
  coverLayout,
  renderSquare,
  visibleSquare,
  type CoverLayout,
  type Point,
  type Size,
  type SquareImage,
} from '@/shared/lib/image'
import { Button } from '@/shared/ui/button'
import { Slider } from '@/shared/ui/slider'

/** The frame on screen, in CSS pixels. */
const FRAME = 256
const MAX_ZOOM = 3
/** How far one arrow press moves the image; with Shift, four times as far. */
const STEP = 8

interface ImageCropperProps {
  /** The picked image, as an object URL the caller owns. */
  src: string
  /** Width and height of the result, in pixels. */
  outputSize?: number
  onCrop: (image: SquareImage) => void
  onCancel: () => void
}

/**
 * Cuts a square out of an image: drag it or move it with the arrows, zoom with
 * the slider, and see the result at the sizes it will be shown at. The square
 * is drawn on a canvas in the browser, so only the result is uploaded.
 */
export const ImageCropper = ({ src, outputSize = 256, onCrop, onCancel }: ImageCropperProps) => {
  const hintId = useId()
  const imageRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ pointer: Point; offset: Point } | null>(null)
  const [natural, setNatural] = useState<Size | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const layout = natural ? coverLayout(natural, FRAME, zoom, offset) : null

  const moveTo = (next: Point) => {
    // Kept inside the edges right away, so a long drag past one does not have
    // to be undone before the image moves back.
    setOffset(natural ? coverLayout(natural, FRAME, zoom, next).offset : next)
  }

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointer: { x: event.clientX, y: event.clientY }, offset }
  }

  const drag = (event: PointerEvent<HTMLButtonElement>) => {
    const start = dragRef.current
    if (!start) {
      return
    }
    moveTo({
      x: start.offset.x + event.clientX - start.pointer.x,
      y: start.offset.y + event.clientY - start.pointer.y,
    })
  }

  const stopDrag = () => {
    dragRef.current = null
  }

  const moveByKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? STEP * 4 : STEP
    const delta: Partial<Record<string, Point>> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    }
    const move = delta[event.key]
    if (!move) {
      return
    }
    event.preventDefault()
    // The arrow moves the view, so the image goes the other way.
    moveTo({ x: offset.x - move.x, y: offset.y - move.y })
  }

  const apply = async () => {
    const image = imageRef.current
    if (!image || !layout) {
      return
    }
    setBusy(true)
    setFailed(false)
    try {
      onCrop(await renderSquare(image, visibleSquare(layout, FRAME), outputSize))
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-4">
        <button
          type="button"
          aria-label="Положение изображения"
          aria-describedby={hintId}
          className="relative shrink-0 cursor-grab touch-none overflow-hidden rounded-2xl bg-bg focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none active:cursor-grabbing"
          style={{ width: FRAME, height: FRAME }}
          onPointerDown={startDrag}
          onPointerMove={drag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onKeyDown={moveByKey}
        >
          <img
            ref={imageRef}
            src={src}
            alt=""
            draggable={false}
            className={cn('absolute max-w-none select-none', !layout && 'invisible')}
            style={layout ? placement(layout, 1) : undefined}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget
              setNatural({ width: naturalWidth, height: naturalHeight })
            }}
          />
        </button>
        <div className="flex flex-col items-center gap-2" aria-hidden="true">
          {[64, 40].map((size) => (
            <span
              key={size}
              className="relative overflow-hidden rounded-xl bg-bg"
              style={{ width: size, height: size }}
            >
              {layout && (
                <img
                  src={src}
                  alt=""
                  className="absolute max-w-none"
                  style={placement(layout, size / FRAME)}
                />
              )}
            </span>
          ))}
        </div>
      </div>
      <p id={hintId} className="text-sm text-fg-muted">
        Перетащите изображение или двигайте его стрелками, масштаб — ползунком.
      </p>
      <Slider
        aria-label="Масштаб"
        min={1}
        max={MAX_ZOOM}
        step={0.05}
        value={[zoom]}
        getValueText={(value) => `${String(Math.round(value * 100))} %`}
        onValueChange={([value]) => {
          if (value === undefined) {
            return
          }
          setZoom(value)
          if (natural) {
            setOffset(coverLayout(natural, FRAME, value, offset).offset)
          }
        }}
      />
      {failed && (
        <p role="alert" className="text-sm text-danger">
          Не получилось обработать изображение. Попробуйте другое.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
        <Button
          type="button"
          disabled={!layout || busy}
          onClick={() => {
            void apply()
          }}
        >
          Применить
        </Button>
      </div>
    </div>
  )
}

/** The image's box inside a frame, scaled for a smaller preview. */
const placement = (layout: CoverLayout, ratio: number) => ({
  width: layout.width * ratio,
  height: layout.height * ratio,
  left: layout.left * ratio,
  top: layout.top * ratio,
})
