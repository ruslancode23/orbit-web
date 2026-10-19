import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderSquare } from '@/shared/lib/image'
import type * as ImageModule from '@/shared/lib/image'
import type { SquareImage } from '@/shared/lib/image'

import { ImageCropper } from './ImageCropper'

// jsdom has no canvas: the drawing itself is the browser's part.
vi.mock('@/shared/lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof ImageModule>()),
  renderSquare: vi.fn(() =>
    Promise.resolve({ blob: new Blob(['x'], { type: 'image/webp' }), dataUrl: 'data:,x' }),
  ),
}))

const renderCropper = () => {
  const onCrop = vi.fn<(image: SquareImage) => void>()
  const onCancel = vi.fn()
  const view = render(<ImageCropper src="blob:picked" onCrop={onCrop} onCancel={onCancel} />)
  return { ...view, onCrop, onCancel }
}

/** A 512×256 picture «arrives»: jsdom never loads one by itself. */
const loadImage = (container: HTMLElement) => {
  const image = container.querySelector('button img')
  if (!(image instanceof HTMLImageElement)) {
    throw new Error('no image')
  }
  Object.defineProperty(image, 'naturalWidth', { value: 512 })
  Object.defineProperty(image, 'naturalHeight', { value: 256 })
  fireEvent.load(image)
}

afterEach(() => {
  vi.mocked(renderSquare).mockClear()
})

it('waits for the image before it can apply', () => {
  renderCropper()

  expect(screen.getByRole('button', { name: 'Применить' })).toBeDisabled()
})

it('cuts the centred square by default', async () => {
  const { container, onCrop } = renderCropper()
  loadImage(container)

  await userEvent.click(screen.getByRole('button', { name: 'Применить' }))

  await waitFor(() => {
    expect(onCrop).toHaveBeenCalled()
  })
  const [result] = onCrop.mock.lastCall ?? []
  expect(result?.dataUrl).toBe('data:,x')
  expect(result?.blob).toBeInstanceOf(Blob)
  expect(renderSquare).toHaveBeenCalledWith(
    expect.any(HTMLImageElement),
    { x: 128, y: 0, size: 256 },
    256,
  )
})

// Everything the mouse does, the keyboard does too.
it('moves the square with the arrows and zooms with the slider', async () => {
  const { container } = renderCropper()
  loadImage(container)

  screen.getByRole('button', { name: 'Положение изображения' }).focus()
  await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
  // Up and down have no room on a wide picture: nothing changes.
  await userEvent.keyboard('{ArrowUp}')
  await userEvent.click(screen.getByRole('button', { name: 'Применить' }))

  await waitFor(() => {
    expect(renderSquare).toHaveBeenLastCalledWith(
      expect.any(HTMLImageElement),
      { x: 112, y: 0, size: 256 },
      256,
    )
  })

  screen.getByRole('slider', { name: 'Масштаб' }).focus()
  await userEvent.keyboard('{End}')
  expect(screen.getByRole('slider', { name: 'Масштаб' })).toHaveAttribute('aria-valuetext', '300 %')
  await userEvent.click(screen.getByRole('button', { name: 'Применить' }))
  await waitFor(() => {
    expect(renderSquare).toHaveBeenCalledTimes(2)
  })
  const [, square] = vi.mocked(renderSquare).mock.calls[1] ?? []
  expect(square?.size).toBeCloseTo(256 / 3)
})

it('says so when the image cannot be drawn', async () => {
  vi.mocked(renderSquare).mockRejectedValueOnce(new Error('no canvas'))
  const { container, onCrop } = renderCropper()
  loadImage(container)

  await userEvent.click(screen.getByRole('button', { name: 'Применить' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Не получилось обработать')
  expect(onCrop).not.toHaveBeenCalled()
})

it('cancels', async () => {
  const { onCancel } = renderCropper()

  await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))

  expect(onCancel).toHaveBeenCalled()
})
