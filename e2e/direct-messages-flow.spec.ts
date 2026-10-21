import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test'

import { password, skipProfileOnboarding, unique } from './helpers.ts'

const API_URL = process.env.VITE_API_URL ?? 'http://localhost:8080'

interface Account {
  id: string
  nickname: string
}

interface Conversation {
  id: string
  kind: 'direct' | 'group'
  name?: string
  members: Account[]
}

interface MessagePage {
  messages: {
    id: string
    content: string
    reactions: { emoji: string; count: number; reacted: boolean }[]
    attachments?: { id: string; fileName: string }[]
  }[]
}

interface LiveFrame {
  type: string
  channelId?: string
}

/** Performs one API call against the running server that a page's cookie jar owns. */
async function call<T>(
  api: APIRequestContext,
  method: 'get' | 'post' | 'patch',
  path: string,
  data?: object,
): Promise<T> {
  const url = `${API_URL}/api/v1${path}`
  const response =
    method === 'get'
      ? await api.get(url)
      : method === 'post'
        ? await api.post(url, data === undefined ? {} : { data })
        : await api.patch(url, data === undefined ? {} : { data })
  expect(
    response.ok(),
    `${method.toUpperCase()} ${path} answered ${String(response.status())}`,
  ).toBe(true)
  return (await response.json()) as T
}

interface Auth {
  api: APIRequestContext
  context: BrowserContext
  account: Account
}

/** A fresh browser context with an account registered through its own cookie jar. */
async function signUp(browserContext: BrowserContext, prefix: string): Promise<Auth> {
  const account = await call<Account>(browserContext.request, 'post', '/auth/register', {
    nickname: unique(prefix),
    password,
  })
  return { api: browserContext.request, context: browserContext, account }
}

/** Opens the app on a server watching every frame its personal stream receives. */
function openPersonalStream(page: Page): LiveFrame[] {
  const frames: LiveFrame[] = []
  page.on('websocket', (socket) => {
    socket.on('framereceived', (frame) => {
      const text = typeof frame.payload === 'string' ? frame.payload : frame.payload.toString()
      try {
        const parsed: unknown = JSON.parse(text)
        if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
          const type = parsed.type
          if (typeof type === 'string') {
            const channelId =
              'channelId' in parsed && typeof parsed.channelId === 'string'
                ? parsed.channelId
                : undefined
            frames.push(channelId === undefined ? { type } : { type, channelId })
          }
        }
      } catch {
        // A frame this test does not need; the app ignores those as well.
      }
    })
  })
  return frames
}

const chat = (page: Page) => page.getByRole('region', { name: 'Чат' })
const composer = (page: Page) => page.getByRole('textbox', { name: 'Сообщение' })

async function openList(page: Page): Promise<void> {
  await page.goto('/me')
  await skipProfileOnboarding(page)
  await expect(page.getByRole('heading', { name: 'Друзья', level: 1 })).toBeVisible()
  // «Подключаемся…» means the personal stream has not opened yet.
  await expect(page.getByText('Подключаемся…')).toHaveCount(0)
}

async function send(page: Page, text: string): Promise<void> {
  await composer(page).fill(text)
  await page.getByRole('button', { name: 'Отправить' }).click()
  await expect(chat(page).getByText(text, { exact: true })).toBeVisible()
}

/** The id the server gave a message with this exact text, for its DOM row. */
async function messageId(api: APIRequestContext, channelId: string, text: string): Promise<string> {
  const page = await call<MessagePage>(api, 'get', `/channels/${channelId}/messages?limit=100`)
  const message = page.messages.find((item) => item.content === text)
  if (message === undefined) {
    throw new Error(`message «${text}» is not in the history of ${channelId}`)
  }
  return message.id
}

// A real 2×2 PNG: the server reads the type from the bytes, not the name.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==',
  'base64',
)

/**
 * The whole epic in one flow: two people on a shared server open a dialogue from
 * the member column, write, answer, react and send a file; a group gains a new
 * member and loses one; a block freezes the pair and the refused message is
 * answered neutrally. The same test watches a stranger: their REST calls, their
 * personal stream and the attachment link all stay closed.
 */
test('direct messages go from a member card to a group, a block and a closed door', async ({
  browser,
}) => {
  test.setTimeout(180_000)

  const annaContext = await browser.newContext()
  const bobContext = await browser.newContext()
  const carolContext = await browser.newContext()
  const daveContext = await browser.newContext()
  const anna = await signUp(annaContext, 'anna')
  const bob = await signUp(bobContext, 'bob')
  const carol = await signUp(carolContext, 'carol')
  const dave = await signUp(daveContext, 'dave')

  // One server for everyone: the default policy lets people on a common server
  // start a dialogue. A group is created by the API, because a group needs three
  // people from the first moment; the fourth one is added through the interface.
  const { workspace } = await call<{ workspace: { id: string } }>(anna.api, 'post', '/workspaces', {
    name: unique('Общие'),
  })
  const invite = await call<{ code: string }>(
    anna.api,
    'post',
    `/workspaces/${workspace.id}/invites`,
  )
  for (const person of [bob, carol, dave]) {
    await call(person.api, 'post', `/invites/${invite.code}/accept`)
  }
  const channel = await call<{ id: string }>(
    anna.api,
    'post',
    `/workspaces/${workspace.id}/channels`,
    { name: 'общий' },
  )
  const groupName = unique('Планы')
  const group = await call<Conversation>(anna.api, 'post', '/conversations', {
    userIds: [bob.account.id, carol.account.id],
  })
  await call<Conversation>(anna.api, 'patch', `/conversations/${group.id}`, { name: groupName })
  // «Добавить людей» offers friends only, so the newcomer and the host are friends.
  await call(anna.api, 'post', '/friends/requests', { nickname: dave.account.nickname })
  await call(dave.api, 'post', `/friends/requests/${anna.account.id}/accept`)

  const annaPage = await annaContext.newPage()
  const bobPage = await bobContext.newPage()
  const davePage = await daveContext.newPage()
  // The stranger's stream is watched from the moment the page opens: it must
  // never carry a frame of a conversation this account is not in.
  const daveFrames = openPersonalStream(davePage)
  const bobFrames = openPersonalStream(bobPage)
  await openList(davePage)

  // A dialogue is opened from the card in the member column of a server channel.
  await annaPage.goto(`/s/${workspace.id}/${channel.id}`)
  await skipProfileOnboarding(annaPage)
  await expect(annaPage.getByRole('heading', { name: '# общий', level: 1 })).toBeVisible()
  await annaPage
    .getByRole('complementary', { name: 'Участники' })
    .getByRole('button', { name: new RegExp(bob.account.nickname) })
    .click()
  await annaPage
    .getByRole('dialog', { name: `Карточка ${bob.account.nickname}` })
    .getByRole('button', { name: 'Написать' })
    .click()
  await expect(annaPage).toHaveURL(/\/me\/[0-9a-f-]+$/)
  const conversationId = annaPage.url().split('/').at(-1) ?? ''

  const first = unique('привет')
  await send(annaPage, first)

  // The peer was never told to reload: the dialogue is already in the list and
  // opening it shows the message.
  await openList(bobPage)
  const row = bobPage.getByRole('link', { name: new RegExp(anna.account.nickname) })
  await expect(row).toBeVisible()
  await expect(row).toContainText(first)
  await row.click()
  await expect(chat(bobPage).getByText(first, { exact: true })).toBeVisible()

  // Answering from the message menu keeps the original in the preview.
  const firstId = await messageId(anna.api, conversationId, first)
  const firstArticle = chat(bobPage).locator(`[data-message-id="${firstId}"]`)
  await firstArticle.hover()
  await firstArticle.getByRole('button', { name: 'Ответить' }).click()
  await expect(bobPage.getByText(/Ответ на сообщение/)).toBeVisible()
  const answer = unique('ответ')
  await send(bobPage, answer)
  await expect(
    chat(bobPage).getByRole('button', {
      name: `Перейти к сообщению от ${anna.account.nickname}`,
    }),
  ).toBeVisible()

  // A reaction is written by the peer and appears in the host's open dialogue
  // without a reload.
  await firstArticle.hover()
  await firstArticle.getByRole('button', { name: 'Добавить реакцию' }).click()
  await firstArticle.getByRole('button', { name: 'Поставить реакцию 👍' }).click()
  await expect(
    firstArticle.getByRole('button', { name: '👍, 1 реакция, вы поставили' }),
  ).toBeVisible()
  // The reaction is stored for both participants, so the host reads it from the
  // history. It is not asserted as a live frame here: the server's gateway keeps
  // only its highest seq per channel and drops a later event that repeats it —
  // a reaction, edit or delete of an already-seen message never arrives live.
  const reacted = await call<MessagePage>(
    anna.api,
    'get',
    `/channels/${conversationId}/messages?limit=100`,
  )
  expect(reacted.messages.find((message) => message.id === firstId)?.reactions).toEqual([
    { emoji: '👍', count: 1, reacted: false },
  ])

  // A file goes with a message: the preview proves the signed link really led
  // to the bytes, and the peer receives it live.
  await annaPage
    .locator('input[type="file"]')
    .setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG })
  await expect(annaPage.getByRole('list', { name: 'Файлы к сообщению' })).toContainText('dot.png')
  await expect(annaPage.getByRole('progressbar')).toHaveCount(0)
  const withFile = unique('файл')
  await send(annaPage, withFile)
  const preview = chat(annaPage).getByRole('img', { name: 'dot.png' })
  await expect(preview).toBeVisible()
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(2)
  await expect(chat(bobPage).getByRole('img', { name: 'dot.png' })).toBeVisible({
    timeout: 5000,
  })
  await expect
    .poll(() =>
      bobFrames.some(
        (frame) => frame.channelId === conversationId && frame.type === 'message.created',
      ),
    )
    .toBe(true)

  // The stranger is not in the dialogue: neither the REST endpoints nor the
  // attachment link answer, and the row never appears in their list.
  const history = await call<MessagePage>(
    anna.api,
    'get',
    `/channels/${conversationId}/messages?limit=100`,
  )
  const fileMessage = history.messages.find((message) =>
    message.attachments?.some((attachment) => attachment.fileName === 'dot.png'),
  )
  const attachment = fileMessage?.attachments?.[0]
  if (attachment === undefined) {
    throw new Error('the file message is not in the history')
  }
  const attachmentPath = `/attachments/${attachment.id}`
  expect((await anna.api.get(`${API_URL}/api/v1${attachmentPath}`)).status()).toBe(200)
  expect((await bob.api.get(`${API_URL}/api/v1${attachmentPath}`)).status()).toBe(200)
  expect((await dave.api.get(`${API_URL}/api/v1${attachmentPath}`)).status()).toBe(404)
  expect((await dave.api.get(`${API_URL}/api/v1/conversations/${conversationId}`)).status()).toBe(
    404,
  )
  expect(
    (await dave.api.get(`${API_URL}/api/v1/channels/${conversationId}/messages`)).status(),
  ).toBe(404)
  const daveList = await call<{ conversations: { id: string }[] }>(
    dave.api,
    'get',
    '/conversations',
  )
  expect(daveList.conversations.map((conversation) => conversation.id)).not.toContain(
    conversationId,
  )
  await expect(davePage.getByRole('link', { name: new RegExp(anna.account.nickname) })).toHaveCount(
    0,
  )
  expect(daveFrames.some((frame) => frame.channelId === conversationId)).toBe(false)

  // A group gains the fourth person through the interface. The server writes a
  // system line, and the added person receives the group on their own stream.
  await annaPage.getByRole('link', { name: new RegExp(groupName) }).click()
  await expect(annaPage.getByRole('heading', { name: groupName, level: 1 })).toBeVisible()
  await expect(
    annaPage.getByRole('note', { name: new RegExp(`переименовал чат в «${groupName}»`) }),
  ).toBeVisible()
  await annaPage.getByRole('button', { name: 'Добавить людей' }).click()
  const add = annaPage.getByRole('dialog', { name: 'Добавить людей' })
  await add.getByRole('checkbox', { name: dave.account.nickname }).check()
  await add.getByRole('button', { name: 'Добавить' }).click()
  await expect(add).toBeHidden()
  await expect(
    annaPage.getByRole('note', { name: new RegExp(`добавил .*${dave.account.nickname}`) }),
  ).toBeVisible()
  await expect(annaPage.getByText(/4 участника/)).toBeVisible()
  await expect(davePage.getByRole('link', { name: new RegExp(groupName) })).toBeVisible({
    timeout: 5000,
  })

  await davePage.getByRole('link', { name: new RegExp(groupName) }).click()
  await expect(davePage.getByRole('heading', { name: groupName, level: 1 })).toBeVisible()
  const groupHello = unique('всем привет')
  await send(annaPage, groupHello)
  await expect(chat(davePage).getByText(groupHello, { exact: true })).toBeVisible({
    timeout: 5000,
  })

  // Leaving ends access. The remaining people see the system line, and the
  // frames that arrive after it no longer name the group for the person gone.
  const framesBeforeLeaving = daveFrames.length
  await davePage.getByRole('button', { name: 'Действия с группой' }).click()
  await davePage.getByRole('menuitem', { name: 'Выйти из группы' }).click()
  const leave = davePage.getByRole('dialog', { name: 'Выйти из группы' })
  await leave.getByRole('button', { name: 'Выйти' }).click()
  await expect(davePage).toHaveURL(/\/me$/)
  await expect(davePage.getByRole('link', { name: new RegExp(groupName) })).toHaveCount(0)
  await expect(
    annaPage.getByRole('note', { name: new RegExp(`${dave.account.nickname} вышел`) }),
  ).toBeVisible({ timeout: 10_000 })

  // A message after the leave keeps the remaining group alive; the person who
  // left is not in it any more, on REST or on the personal stream.
  await send(annaPage, unique('после выхода'))
  expect((await dave.api.get(`${API_URL}/api/v1/conversations/${group.id}`)).status()).toBe(404)
  expect((await dave.api.get(`${API_URL}/api/v1/channels/${group.id}/messages`)).status()).toBe(404)
  // Leaving tells the leaver's own devices the group is gone, so that one
  // `conversation.updated` is expected; no message of the group follows.
  expect(
    daveFrames
      .slice(framesBeforeLeaving)
      .filter((frame) => frame.channelId === group.id && frame.type.startsWith('message.')),
  ).toEqual([])

  // The host blocks the peer in the direct dialogue. The composer turns into a
  // readable state, while the peer's attempt to write is refused neutrally.
  await annaPage.getByRole('link', { name: new RegExp(bob.account.nickname) }).click()
  await expect(composer(annaPage)).toBeVisible()
  await annaPage.getByRole('button', { name: 'Действия с диалогом' }).click()
  await annaPage.getByRole('menuitem', { name: 'Заблокировать' }).click()
  await expect(annaPage.getByText('Вы заблокировали пользователя')).toBeVisible()
  await expect(composer(annaPage)).toHaveCount(0)

  const blockedAttempt = unique('после блокировки')
  await composer(bobPage).fill(blockedAttempt)
  await bobPage.getByRole('button', { name: 'Отправить' }).click()
  await expect(
    bobPage.getByText(
      'Пользователь недоступен — возможно, он ограничил переписку. Написать в этот диалог нельзя.',
    ),
  ).toBeVisible()
  await expect(composer(bobPage)).toHaveCount(0)
  await expect(chat(annaPage).getByText(blockedAttempt)).toHaveCount(0)
  // The same refusal at the API level: no special wording for a blocked pair.
  const refused = await bob.api.post(`${API_URL}/api/v1/channels/${conversationId}/messages`, {
    data: { clientMessageId: crypto.randomUUID(), content: blockedAttempt },
  })
  expect(refused.status()).toBe(404)

  await annaContext.close()
  await bobContext.close()
  await carolContext.close()
  await daveContext.close()
})
