import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { AttachmentList } from './AttachmentList'

import type { Attachment } from '../model/attachment'

const image: Attachment = {
  id: 'a-image',
  fileName: 'cat.png',
  mimeType: 'image/png',
  sizeBytes: 2048n,
  width: 640,
  height: 480,
  createdAt: new Date('2026-10-20T10:00:00Z'),
}
const document: Attachment = {
  id: 'a-doc',
  fileName: 'plan.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 3n * 1024n * 1024n,
  createdAt: new Date('2026-10-20T10:00:00Z'),
}

/** Signed links for the ids given; any other id answers 404. */
const stubLinks = (available: string[]) => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: Request) => {
      const id = input.url.slice(input.url.lastIndexOf('/') + 1)
      const attachment = [image, document].find((item) => item.id === id)
      if (!attachment || !available.includes(id)) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { code: 'not_found', message: 'gone' } }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            url: `https://files.test/${id}?signature=x`,
            expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
            attachment: { ...attachment, sizeBytes: Number(attachment.sizeBytes) },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('shows an image preview and a download by the signed link', async () => {
  stubLinks([image.id, document.id])
  renderWithProviders(<AttachmentList attachments={[image, document]} />)

  const preview = await screen.findByRole('img', { name: 'cat.png' })
  expect(preview).toHaveAttribute('src', 'https://files.test/a-image?signature=x')
  expect(await screen.findByRole('link', { name: 'Скачать plan.pdf' })).toHaveAttribute(
    'href',
    'https://files.test/a-doc?signature=x',
  )
  expect(screen.getByText('3 МБ')).toBeInTheDocument()
})

it('opens the image in full size and closes it with Escape', async () => {
  stubLinks([image.id])
  renderWithProviders(<AttachmentList attachments={[image]} />)

  await userEvent.click(
    await screen.findByRole('button', { name: 'Открыть cat.png в полном размере' }),
  )
  const viewer = screen.getByRole('dialog', { name: 'cat.png' })
  expect(within(viewer).getByRole('img', { name: 'cat.png' })).toBeInTheDocument()

  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('shows a placeholder for a file that is gone, and keeps the rest', async () => {
  stubLinks([document.id])
  renderWithProviders(<AttachmentList attachments={[image, document]} />)

  expect(await screen.findByText('Вложение недоступно: cat.png')).toBeInTheDocument()
  expect(await screen.findByRole('link', { name: 'Скачать plan.pdf' })).toBeInTheDocument()
})

it('shows a placeholder when the image itself does not load', async () => {
  stubLinks([image.id])
  renderWithProviders(<AttachmentList attachments={[image]} />)

  fireEvent.error(await screen.findByRole('img', { name: 'cat.png' }))

  expect(screen.getByText('Вложение недоступно: cat.png')).toBeInTheDocument()
})
