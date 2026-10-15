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
