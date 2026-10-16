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
```

Node 22+, pnpm 11. Не используй npm или yarn — lockfile только `pnpm-lock.yaml`.

## Стек

React 19, TypeScript (strict, `noUncheckedIndexedAccess`), Vite 8, React Router, Radix UI (`radix-ui`),
Tailwind CSS 4, `class-variance-authority`, TanStack Query, Vitest + Testing Library. Медиа — `livekit-client`.
По PRD позже добавятся Zustand и TanStack Virtual — не тащи другие аналоги.

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

- Только именованные экспорты (`import-x/no-default-export`), кроме конфигов инструментов.
- `import type` для типов. Без `any`, без `as` ради обхода типов, без `// @ts-ignore` и `eslint-disable`.
- Компоненты — функции, файл компонента в PascalCase (`Button.tsx`), тест рядом (`Button.test.tsx`).
- Обращения к ОС и браузерным API (уведомления, устройства, захват экрана, автозапуск) — только через
  `PlatformAdapter` из `shared/platform`. Компоненты не вызывают Tauri и браузерные API напрямую (PRD 11.0).
- Переменные окружения — только через `@/shared/config`; новые описываются в `src/vite-env.d.ts`, `.env.example`
  и `.env.test` (значения для Vitest и CI).
- API orbit-server генерируется из `api/orbit-server.openapi.yaml` (Hey API) в `src/shared/api/generated/`
  перед `dev`, `build`, `typecheck`, `lint` и `test`. Сгенерированное не коммитится и не правится руками.
- Запросы — только через `@/shared/api`: `useQuery(getReadinessOptions())`, `useMutation(createVoiceTokenMutation())`.
  Не пиши `fetch`, типы ответов и query keys вручную; не импортируй `shared/api/generated` напрямую.
- Все ошибки запросов — `ApiError` (`status: 0` — нет сети, `error.code` — код сервера).
- API изменился на сервере → `pnpm api:pull` (из `main`, ветки или локального пути) и закоммить новый снимок.
- Серверное состояние — TanStack Query; не дублируй его в локальном стейте.

## UI и стили

- Компоненты ui-kit — в `shared/ui/<name>/` на примитивах Radix, варианты через `cva`, классы объединяются `cn()`.
- Цвета и шрифты — только токены из `@theme` в `src/app/styles/index.css` (`bg-surface`, `text-fg-muted`).
  Не пиши сырые цвета (`bg-[#123]`, `text-gray-500`).
- Доступность обязательна: `jsx-a11y` в линтере, у интерактивных элементов есть доступное имя, фокус виден.
- Тексты интерфейса — на русском.

## Тесты

Каждая функция — с тестами. Тестируй поведение через роли и тексты (`getByRole`), а не детали реализации.
Сквозные сценарии (Playwright) добавятся вместе с первым экраном комнаты.

## Производительность (PRD, раздел 10)

Начальный бандл ≤ 300 КБ gzip. Тяжёлое (livekit-client, страница комнаты) грузи лениво через `lazy()`.
Длинные списки — виртуализация. Не оставляй подписки и медиатреки без очистки в `useEffect`.

## Git

- Задачи — в Jira, проект SCRUM (эпик SCRUM-5). Ветки: `feat/…`, `fix/…`, `chore/…`, ключ задачи Jira в имени: `feat/SCRUM-9-join-room`.
- Сообщения коммитов — на английском, в повелительном наклонении: `Add join room feature`.
- Не коммить `.env.local` и секреты. Не делай push и не создавай PR без просьбы.
