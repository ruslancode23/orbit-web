import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { build } from '@/shared/config'
import { createFakePlatform, renderWithProviders } from '@/shared/lib/test'
import { setPlatform } from '@/shared/platform'

import { ReportBugDialog } from './ReportBugDialog'

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

const created = () =>
  json({ id: '3f1c2d4e-0000-4000-8000-000000000001', createdAt: new Date() }, 201)

/** Every report the fake server received, as the form data it was sent with. */
const stubReports = (answer: () => Response = created) => {
  const sent: FormData[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      if (
        input instanceof Request &&
        new URL(input.url).pathname === '/api/v1/bug-reports' &&
        input.method === 'POST'
      ) {
        sent.push(await input.formData())
        return answer()
      }
      return json({ error: { code: 'not_found', message: 'no' } }, 404)
    }),
  )
  return sent
}

const renderDialog = (route = '/s/ws-1/ch-2?highlight=7') => {
  const onClose = vi.fn()
  const view = renderWithProviders(<ReportBugDialog onClose={onClose} />, { route })
  return { ...view, onClose }
}

const png = (name = 'shot.png', size = 64) =>
  new File([new Uint8Array(size)], name, { type: 'image/png' })

beforeEach(() => {
  setPlatform(createFakePlatform())
})

afterEach(() => {
  setPlatform(null)
  vi.unstubAllGlobals()
})

it('sends the description, the steps and the context the client attaches', async () => {
  const sent = stubReports()
  const { onClose } = renderDialog()

  // What goes out besides the text is listed before sending.
  expect(screen.getByText(`Версия: ${build.version}`)).toBeInTheDocument()
  expect(screen.getByText('Браузер и система: FakeBrowser/1.0 (TestOS)')).toBeInTheDocument()
  expect(screen.getByText('Страница: /s/ws-1/ch-2')).toBeInTheDocument()

  await userEvent.type(screen.getByLabelText('Что случилось'), '  Сообщение пропало  ')
  await userEvent.type(screen.getByLabelText('Как повторить'), 'Отправить и обновить')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  await waitFor(() => {
    expect(onClose).toHaveBeenCalled()
  })
  expect(sent).toHaveLength(1)
  const form = sent[0]
  expect(form?.get('description')).toBe('Сообщение пропало')
  expect(form?.get('steps')).toBe('Отправить и обновить')
  expect(form?.get('appVersion')).toBe(build.version)
  expect(form?.get('userAgent')).toBe('FakeBrowser/1.0 (TestOS)')
  expect(form?.get('route')).toBe('/s/ws-1/ch-2')
  expect(form?.has('screenshot')).toBe(false)
  expect(await screen.findByText(/Отчёт № 3f1c2d4e отправлен/)).toBeInTheDocument()
})

it('masks an invite code in the route', async () => {
  const sent = stubReports()
  const { onClose } = renderDialog('/invite/very-secret-code')

  await userEvent.type(screen.getByLabelText('Что случилось'), 'Не открывается')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  await waitFor(() => {
    expect(onClose).toHaveBeenCalled()
  })
  expect(sent[0]?.get('route')).toBe('/invite/:code')
  expect(screen.queryByText(/very-secret-code/)).not.toBeInTheDocument()
})

it('needs a description and sends nothing without one', async () => {
  const sent = stubReports()
  renderDialog()

  await userEvent.type(screen.getByLabelText('Что случилось'), '   ')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  expect(await screen.findByText(/Опишите, что случилось/)).toBeInTheDocument()
  expect(screen.getByLabelText('Что случилось')).toHaveAttribute('aria-invalid', 'true')
  expect(sent).toHaveLength(0)
})

it('attaches a screenshot and lets it go again', async () => {
  const sent = stubReports()
  const { onClose } = renderDialog()

  await userEvent.upload(screen.getByLabelText('Файл скриншота'), png('error.png', 2048))
  expect(screen.getByText('error.png · 2 КБ')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Убрать скриншот' }))
  expect(screen.queryByText(/error\.png/)).not.toBeInTheDocument()

  await userEvent.upload(screen.getByLabelText('Файл скриншота'), png('again.png'))
  await userEvent.type(screen.getByLabelText('Что случилось'), 'Кнопка не работает')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  await waitFor(() => {
    expect(onClose).toHaveBeenCalled()
  })
  // The bytes go as a file part; the server reads the type from them, not from the name.
  expect(sent[0]?.get('screenshot')).toMatchObject({ size: 64, type: 'image/png' })
})

it('refuses a screenshot that is not an image before sending', async () => {
  const sent = stubReports()
  renderDialog()

  await userEvent.upload(
    screen.getByLabelText('Файл скриншота'),
    new File(['GIF89a'], 'anim.gif', { type: 'image/gif' }),
    { applyAccept: false },
  )
  await userEvent.type(screen.getByLabelText('Что случилось'), 'Что-то сломалось')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  expect(await screen.findByText('Нужна картинка PNG, JPEG или WebP.')).toBeInTheDocument()
  expect(sent).toHaveLength(0)
})

it('puts a 400 next to the field the server named', async () => {
  stubReports(() =>
    json(
      { error: { code: 'invalid_request', message: 'steps: must not exceed 4000 characters' } },
      400,
    ),
  )
  const { onClose } = renderDialog()

  await userEvent.type(screen.getByLabelText('Что случилось'), 'Ошибка')
  await userEvent.type(screen.getByLabelText('Как повторить'), 'Шаги')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  expect(await screen.findByText(/Шаги не подошли/)).toBeInTheDocument()
  expect(screen.getByLabelText('Как повторить')).toHaveAttribute('aria-invalid', 'true')
  expect(onClose).not.toHaveBeenCalled()
})

it('puts a 413 on the screenshot', async () => {
  stubReports(() =>
    json({ error: { code: 'body_too_large', message: 'screenshot: too large' } }, 413),
  )
  renderDialog()

  await userEvent.upload(screen.getByLabelText('Файл скриншота'), png())
  await userEvent.type(screen.getByLabelText('Что случилось'), 'Ошибка')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  expect(await screen.findByText(/Скриншот слишком большой/)).toBeInTheDocument()
})

it('says how long to wait after 429 and keeps the text', async () => {
  stubReports(() =>
    json({ error: { code: 'too_many_requests', message: 'too many' } }, 429, {
      'Retry-After': '1200',
    }),
  )
  const { onClose } = renderDialog()

  await userEvent.type(screen.getByLabelText('Что случилось'), 'Опять сломалось')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Вы отправили много отчётов подряд. Попробуйте снова через 20 мин.',
  )
  expect(screen.getByLabelText('Что случилось')).toHaveValue('Опять сломалось')
  expect(onClose).not.toHaveBeenCalled()
})
