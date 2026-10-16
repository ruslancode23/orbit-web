# orbit-web

Web-клиент Orbit: React 19 + TypeScript + Vite, Radix UI + Tailwind CSS 4.
Архитектура — [Feature-Sliced Design](https://feature-sliced.design).

## Запуск

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Нужен Node.js 22+ и pnpm 11. Бэкенд и LiveKit поднимаются из репозитория `orbit-server`.

## Скрипты

| Команда         | Что делает                          |
| --------------- | ----------------------------------- |
| `pnpm dev`      | dev-сервер на http://localhost:5173 |
| `pnpm build`    | проверка типов и production-сборка  |
| `pnpm lint`     | ESLint, включая правила слоёв FSD   |
| `pnpm lint:fsd` | Steiger — линтер структуры FSD      |
| `pnpm format`   | Prettier                            |
| `pnpm test`     | Vitest                              |
| `pnpm check`    | всё перечисленное разом, как в CI   |

## API

Клиент orbit-server генерируется из снимка спецификации [`api/orbit-server.openapi.yaml`](api/orbit-server.openapi.yaml)
с помощью [Hey API](https://heyapi.dev): типы, SDK и функции для TanStack Query. Генерация запускается сама перед
`dev`, `build`, `typecheck`, `lint` и `test`; результат в `src/shared/api/generated/` не коммитится.

```tsx
import { useMutation, useQuery } from '@tanstack/react-query'

import { createVoiceTokenMutation, getReadinessOptions } from '@/shared/api'

const readiness = useQuery(getReadinessOptions())
const join = useMutation(createVoiceTokenMutation())
join.mutate({ body: { room: 'dev-room', displayName: 'Anna' } })
```

Любой неуспешный запрос — `ApiError` с `status` (0, если ответа нет) и `error.code` от сервера.

Сервер поменял API — обнови снимок и закоммить его:

```bash
pnpm api:pull                                   # orbit-server main
pnpm api:pull feat/some-branch                  # ветка или коммит
pnpm api:pull ../orbit-server/api/openapi.yaml  # локальный checkout
```

## E2E-тесты

Сквозные сценарии в `e2e/` идут против настоящих orbit-server и LiveKit. Браузеры запускаются с фейковым
микрофоном, который играет тон, поэтому тест проверяет, что звук действительно доходит до собеседника.

```bash
cd ../orbit-server && make up && make run   # в отдельном терминале, ORBIT_ENV=development
pnpm exec playwright install chromium       # один раз
pnpm test:e2e
```

## Структура

```
src/
  app/        entrypoint, routes, styles — инициализация приложения
  pages/      страницы (слайс = маршрут)
  widgets/    крупные самостоятельные блоки UI
  features/   пользовательские действия (войти, отправить сообщение)
  entities/   бизнес-сущности (user, server, channel, message)
  shared/     ui-kit, lib, api, config — без бизнес-логики
```

Правила, которые проверяет линтер:

- слой импортирует только из слоёв ниже себя;
- слайсы одного слоя не импортируют друг друга;
- слайс импортируется только через публичный API: `@/features/send-message`, а не `@/features/send-message/ui/Form`;
- `shared` импортируется до модуля сегмента: `@/shared/ui/button`;
- внутри слайса — относительные импорты, между слоями — алиас `@/`.

## UI

Компоненты лежат в `shared/ui` на основе примитивов Radix (`radix-ui`), стили — классы Tailwind,
варианты — `class-variance-authority`. CSS собирается в статический `.css`, без CSS-in-JS.
Цвета берутся только из токенов `@theme` в `src/app/styles/index.css`.
