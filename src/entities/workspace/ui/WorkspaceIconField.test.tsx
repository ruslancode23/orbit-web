import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import type * as ImageModule from '@/shared/lib/image'

import { WorkspaceIconField } from './WorkspaceIconField'

import type { WorkspaceIconChange } from '../model/form'

// jsdom has no canvas: the drawing itself is the browser's part.
vi.mock('@/shared/lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof ImageModule>()),
  renderSquare: vi.fn(() =>
    Promise.resolve({ blob: new Blob(['x'], { type: 'image/webp' }), dataUrl: 'data:,cropped' }),
  ),
}))

const changes: WorkspaceIconChange[] = []

const Harness = ({ currentIconUrl = null }: { currentIconUrl?: string | null }) => {
  const [value, setValue] = useState<WorkspaceIconChange>({ kind: 'keep' })
  return (
    <WorkspaceIconField
      value={value}
      onChange={(next) => {
        changes.push(next)
        setValue(next)
      }}
      name="Команда"
      currentIconUrl={currentIconUrl}
    />
  )
}

const png = () => new File([new Uint8Array(16)], 'icon.png', { type: 'image/png' })

const revoke = vi.fn()

beforeEach(() => {
  changes.length = 0
  revoke.mockClear()
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn(() => 'blob:picked')
  URL.revokeObjectURL = revoke
})

const preview = (container: HTMLElement) => container.querySelector('[aria-hidden="true"] img')

it('says why a picture will not do, without opening the cropper', async () => {
  render(<Harness />)

  await userEvent.upload(
    screen.getByLabelText('Файл изображения'),
    new File(['gif'], 'icon.gif', { type: 'image/gif' }),
    { applyAccept: false },
  )

  expect(screen.getByRole('alert')).toHaveTextContent('PNG, JPEG или WebP')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await userEvent.upload(
    screen.getByLabelText('Файл изображения'),
    new File([new Uint8Array(11 * 1024 * 1024)], 'big.png', { type: 'image/png' }),
  )
  expect(screen.getByRole('alert')).toHaveTextContent('Файл больше 10 МБ')
})

it('crops the picked picture and previews the result', async () => {
  const { container } = render(<Harness />)
  expect(screen.getByRole('button', { name: 'Выбрать изображение' })).toBeInTheDocument()

  await userEvent.upload(screen.getByLabelText('Файл изображения'), png())

  const dialog = screen.getByRole('dialog', { name: 'Обрезка аватара' })
  const image = dialog.querySelector('button img')
  if (!(image instanceof HTMLImageElement)) throw new Error('no image')
  Object.defineProperty(image, 'naturalWidth', { value: 300 })
  Object.defineProperty(image, 'naturalHeight', { value: 300 })
  fireEvent.load(image)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Применить' }))

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  expect(changes.at(-1)).toMatchObject({ kind: 'set', previewUrl: 'data:,cropped' })
  expect(preview(container)).toHaveAttribute('src', 'data:,cropped')
  expect(revoke).toHaveBeenCalledWith('blob:picked')
  expect(screen.getByRole('button', { name: 'Заменить' })).toBeInTheDocument()
})

it('keeps the icon as it was when the cropper is closed', async () => {
  render(<Harness />)

  await userEvent.upload(screen.getByLabelText('Файл изображения'), png())
  await userEvent.keyboard('{Escape}')

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(changes).toEqual([])
  expect(revoke).toHaveBeenCalledWith('blob:picked')
})

it('removes the current icon', async () => {
  const { container } = render(<Harness currentIconUrl="https://files.test/icon.webp" />)
  expect(preview(container)).toHaveAttribute('src', 'https://files.test/icon.webp')

  await userEvent.click(screen.getByRole('button', { name: 'Убрать' }))

  expect(changes).toEqual([{ kind: 'remove' }])
  expect(preview(container)).toBeNull()
  expect(screen.getByRole('button', { name: 'Выбрать изображение' })).toBeInTheDocument()
})
