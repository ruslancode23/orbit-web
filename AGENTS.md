# AGENTS.md — orbit-web

Инструкции для AI-агентов (Claude Code, Codex, Cursor и др.) и для людей.

Orbit — открытое приложение с постоянными голосовыми комнатами для команд и сообществ.
Этот репозиторий — web-клиент. API-сервер — отдельный репозиторий `orbit-server`.
Источник требований — PRD 3.1 (Orbit — PRD 3.0 в Claude Docs). Текущий этап — spike: голос и экран в браузере.

## Команды

```bash
pnpm install
pnpm dev          # http://localhost:5173, нужен .env.local (cp .env.example .env.local)
pnpm check        # typecheck + lint + lint:fsd + format:check + test — запускай перед тем, как считать задачу готовой
pnpm lint:fix && pnpm format   # автоисправления
pnpm test         # Vitest; один файл: pnpm vitest run src/shared/ui/button
pnpm test:e2e     # Playwright против живых orbit-server + LiveKit (make up && make run в orbit-server)
```

Node 22+, pnpm 11. Не используй npm или yarn — lockfile только `pnpm-lock.yaml`.

## Стек

React 19, TypeScript (strict, `noUncheckedIndexedAccess`), Vite 8, React Router, Radix UI (`radix-ui`),
Tailwind CSS 4, `class-variance-authority`, TanStack Query, TanStack Virtual, React Hook Form,
Vitest + Testing Library. Медиа — `livekit-client`. По PRD позже добавится Zustand — не тащи другие аналоги.

Не добавляй: Material UI и любой CSS-in-JS (Emotion, styled-components), Redux, axios, moment, lodash целиком.
Новая зависимость — только если без неё никак; решение уровня стека фиксируй в `docs/adr/`.

## Архитектура: Feature-Sliced Design

```
src/app       → entrypoint, routes, styles
src/pages     → страницы, слайс = маршрут
src/widgets   → крупные блоки UI
src/features  → действия пользователя
src/entities  → бизнес-сущности
src/shared    → ui, lib, api, config — без бизнес-логики
```

Правила проверяются линтером (`eslint-plugin-boundaries`, `no-restricted-imports`, Steiger). Не отключай их.

- Слой импортирует только слои ниже. Слайсы одного слоя не импортируют друг друга.
- Слайс экспортирует публичный API через `index.ts`; снаружи — только `@/features/<slice>`.
- `shared` — до модуля сегмента: `@/shared/ui/button`, `@/shared/lib/cn`.
- Между слоями — алиас `@/`, внутри слайса — относительные пути.
- Сегменты называются по назначению: `ui`, `model`, `api`, `lib`, `config`. Не `components`, `hooks`, `utils`, `types`.
- Нужно что-то общее двум фичам — опусти в `entities` или `shared`, а не импортируй фичу из фичи.

## Код

- Экспорты именованные (`import-x/no-default-export`). Исключение — страницы: `pages/*/ui/*Page.tsx` и
  `pages/*/index.ts` экспортируют страницу только по умолчанию (`export default LoginPage`,
  `export { default } from './ui/LoginPage'`), роутер берёт её так же и в `lazy()`. Плюс конфиги инструментов.
- Компоненты — стрелочные функции (`export const Button = () => …`), и всё, что объявлено внутри
  компонента, — тоже (`const handleSubmit = () => …`). В `.tsx` `function`-объявлений нет вообще:
  это проверяют `react/function-component-definition` и `func-style`. Файл компонента в PascalCase
  (`Button.tsx`), тест рядом (`Button.test.tsx`).
- Формы — React Hook Form: `useForm` + `register`, проверки в правилах `register` (`required`,
  `minLength`, `validate`), отправка через `handleSubmit`. Не заводи `useState` на каждое поле. Значение
  поля для отрисовки — `useWatch`, а не `watch()`: с `watch` React Compiler пропускает компонент. Свой
  `ref` на поле совмещай с `register(...).ref` в одном callback-ref. Состояние не формы (открыт ли
  попап, где каретка) остаётся в `useState`.
- `import type` для типов. Без `any`, без `as` ради обхода типов, без `// @ts-ignore` и `eslint-disable`.
- Обращения к ОС и браузерным API (уведомления, устройства, захват экрана, автозапуск) — только через
  `getPlatform()` из `@/shared/platform` (`PlatformAdapter`). Компоненты не вызывают Tauri и браузерные API
  напрямую (PRD 11.0), это проверяет ESLint. Что остаётся внутри livekit-client — `docs/adr/0004-platform-adapter.md`.
- Переменные окружения — только через `@/shared/config`; новые описываются в `src/vite-env.d.ts`, `.env.example`
  и `.env.test` (значения для Vitest и CI).
- API orbit-server генерируется из `api/orbit-server.openapi.yaml` (Hey API) в `src/shared/api/generated/`
  перед `dev`, `build`, `typecheck`, `lint` и `test`. Сгенерированное не коммитится и не правится руками.
- Запросы — только через `@/shared/api`: `useQuery(getReadinessOptions())`, `useMutation(createVoiceTokenMutation())`.
  Не пиши `fetch`, типы ответов и query keys вручную; не импортируй `shared/api/generated` напрямую.
- Все ошибки запросов — `ApiError` (`status: 0` — нет сети, `error.code` — код сервера).
- API изменился на сервере → `pnpm api:pull` (из `main`, ветки или локального пути) и закоммить новый снимок.
- Workflow `API drift` сверяет снимок с `main` orbit-server (еженедельно, вручную, в PR — без блокировки); упал — `pnpm api:pull`.
- Серверное состояние — TanStack Query; не дублируй его в локальном стейте.

## UI и стили

- Компоненты ui-kit — в `shared/ui/<name>/` на примитивах Radix, варианты через `cva`, классы объединяются `cn()`.
- Цвета и шрифты — только токены из `@theme` в `src/app/styles/index.css` (`bg-surface`, `text-fg-muted`).
  Не пиши сырые цвета (`bg-[#123]`, `text-gray-500`).
- Доступность обязательна: `jsx-a11y` в линтере, у интерактивных элементов есть доступное имя, фокус виден.
- Тексты интерфейса — на русском.

## Тесты

Каждая функция — с тестами. Тестируй поведение через роли и тексты (`getByRole`), а не детали реализации.
Компоненты с запросами рендери через `renderWithProviders` из `@/shared/lib/test`; `fetch` подменяй `vi.stubGlobal`,
`livekit-client` — фейковым `FakeRoom` из `@/shared/lib/test` через `vi.mock`, платформу — `setPlatform(createFakePlatform())`
и `setPlatform(null)` в `afterEach` (пример — `features/share-screen/ui/ShareScreen.test.tsx`).
Сценарии с медиа проверяй в `e2e/` (Playwright, фейковый микрофон): юнит-тест не докажет, что звук доходит.

## Аккаунты и сессии

Сессия живёт в cookie `orbit_session` (HttpOnly), поэтому запросы идут с `credentials: 'include'`
(`shared/api/client-config.ts`), а кто вошёл — знает только сервер: `useSession()` из
`entities/session` спрашивает `GET /auth/me`. Маршруты за `RequireSession` (`app/routes`) ждут первого
ответа и только потом решают, пускать или вести на `/login`. Ответ 401 на любом запросе чистит кеш
TanStack Query и сбрасывает сессию (`shared/api/query-client.ts`), после чего guard уводит на вход.
Страница комнаты пока открыта: голос работает на dev-эндпоинте токена, она уйдёт за сессию вместе с
оболочкой приложения (2.12).

## Оболочка и живой поток

`widgets/app-shell` — рамка для всех страниц с сессией: серверы слева, каналы рядом, канал в середине;
маршруты `/s/:workspaceId/:channelId`. Одно WebSocket-соединение на всё приложение держит
`entities/live` (`LiveProvider` над роутером, `useLive()` внутри): смена канала и сервера — это только
новый кадр `subscribe`, сокет не пересоздаётся, а после обрыва соединение возвращается само и повторяет
последнюю подписку. Поток открывается только при живой сессии: без cookie он собирал бы 401.
События не несут данных в стор — они помечают запросы TanStack Query устаревшими, источник правды один.
Кнопки следуют роли с сервера (`atLeast` из `entities/workspace`), но это удобство: сервер проверяет
права заново на каждом действии.

## Чат

`widgets/channel-chat` — история канала: виртуализованный список (`TanStack Virtual`), страницы по 50
сообщений назад по курсору `nextBefore`, порядок на экране — от старых к новым. Новое сообщение
прижимает список к низу только если читатель уже внизу; иначе появляется кнопка «К новым сообщениям».
Отправка — `features/send-message`: в теле идёт `clientMessageId`, поэтому повтор после обрыва даёт то
же сообщение, а не второе. Офлайн TanStack Query сам держит мутацию на паузе и отправляет её, когда
сеть вернулась, — композер говорит об этом, а не показывает ошибку. Оптимистичной вставки нет: источник
правды — история, её же освежает живое событие (`message.*` гасит и обычный, и infinite-ключ).
Группировку (имя и время один раз на серию) и подпись автора держит `entities/message`.

Упоминания, ответы, реакции, правка и удаление — `features/send-message` и `features/message-actions`.
`@` в композере открывает участников сервера (стрелки, Enter, Esc), ник вставляется в текст, а id
уходят в `mentions`: сервер сам текст не разбирает. Ответ несёт `replyToId`, превью в карточке
прокручивает к исходному сообщению, пока оно загружено. Реакция, правка и удаление возвращают
изменённое сообщение, и оно точечно кладётся в кеш истории (`replaceMessageInHistory`) вместо
перезапроса всей ленты. Живое событие всё равно помечает историю устаревшей — иначе чужие
изменения не доедут. Правка и удаление предлагаются только автору, удаление спрашивает
подтверждение. По реакции сервер отдаёт лишь emoji, счётчик и «я среди них», поэтому подсказка
говорит «вы и ещё N», а не имена.

## Непрочитанные и уведомления

Счётчики — `entities/unread`: `GET /workspaces/{id}/unread` одним запросом на сервер. Сервер, за которым
следит поток, обновляется по событиям (`message.*` и личное `read.changed` гасят его ключ); остальные
серверы в ленте слева переспрашиваются раз в минуту — поток держит только один сервер. Отметка
прочитанного (`useReadOnView`) двигает курсор до последнего сообщения, когда читатель внизу ленты и
вкладка видна (`usePageVisible` из `shared/lib/page-visibility`); ответ сразу кладётся в кеш счётчиков,
а другие устройства узнают через `read.changed`. Разделитель «Новые сообщения» стоит там, где был
курсор при открытии канала, и не двигается, пока читатель в канале; свои сообщения его не ставят.

Уведомления — `features/notifications`: `useMessageNotifications` слушает `message.created` через
`useLive().listen` и показывает их только через `getPlatform().notifications`. Не уведомляем о своих
сообщениях и об открытом канале в видимой вкладке. Режим (все, только упоминания, выключены) хранится
на устройстве в `localStorage`; разрешение браузера спрашивается только по действию человека — при
выборе режима или по кнопке, никогда при загрузке.

Поля int64 (`seq`) в телах запросов уходят числами: генератор пишет `bigint` строкой, сервер такую
строку отклоняет, поэтому `bodySerializer` задан в `shared/api/client-config.ts`.

## Медиа (LiveKit)

- Комнатой владеет сущность `entities/voice-room`: `VoiceRoomProvider` (подключение, микрофон, удалённое аудио,
  участники, чужие экраны) и `useVoiceRoom()`. Фичи (`join-room`, `share-screen`, дальше устройства) работают через
  неё и не создают свой `Room`. Страница оборачивает себя в провайдер.
- Страницы с медиа грузятся лениво, чтобы livekit-client не попал в начальный бандл.
- При уходе со страницы и выходе — `room.disconnect()`: он останавливает локальные треки и освобождает микрофон.
- Удалённое аудио прикрепляется `track.attach()` в скрытый контейнер и снимается на `TrackUnsubscribed`.
- Переподключение после потери сети делает сам LiveKit (resume, затем full reconnect, ~45 с) и сам переопубликует
  микрофон и экран; провайдер в это время отдаёт `status: 'reconnecting'`. Если LiveKit сдался — `status: 'disconnected'` и
  `connectionLoss`; повторный вход со свежим токеном — `features/reconnect-room`. Офлайн в e2e — `context.setOffline()`.
- Mute, deafen и громкость участника — действия `useVoiceRoom()`. Deafen — громкость всех на 0 через
  `RemoteParticipant.setVolume()` плюс атрибут участника `deafened`, чтобы его видели другие (в токене нужен
  `canUpdateOwnMetadata`). Индикатор говорящего — по `ActiveSpeakersChanged`, без опроса уровней; задержку задаёт
  `audio.update_interval` LiveKit (`deploy/livekit.yaml` в orbit-server).
- React Compiler считает ref-ом любое значение с суффиксом `Ref` и всё, что передаётся в проп `ref`: не возвращай из хуков
  объект с ref внутри, деструктурируй результат.

## Производительность (PRD, раздел 10)

Начальный бандл ≤ 300 КБ gzip. Тяжёлое (livekit-client, страница комнаты) грузи лениво через `lazy()`.
Длинные списки — виртуализация. Не оставляй подписки и медиатреки без очистки в `useEffect`.

## Git

- Задачи — в Jira, проект SCRUM (эпик SCRUM-5). Ветки: `feat/…`, `fix/…`, `chore/…`, ключ задачи Jira в имени: `feat/SCRUM-9-join-room`.
- Сообщения коммитов — на английском, в повелительном наклонении: `Add join room feature`.
- Заголовок и описание PR — на русском: что сделано, зачем, как проверено, что не покрыто.
- Не коммить `.env.local` и секреты. Не делай push и не создавай PR без просьбы.
