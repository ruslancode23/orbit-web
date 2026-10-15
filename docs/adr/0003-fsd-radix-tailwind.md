# ADR-0003. Feature-Sliced Design, Radix UI и Tailwind CSS

Дата: 2026-10-16 · Статус: принято

## Решение

- Архитектура клиента — Feature-Sliced Design: слои `app → pages → widgets → features → entities → shared`.
  Границы проверяют ESLint (`pnpm lint`) и Steiger (`pnpm lint:fsd`).
- UI-kit — свои компоненты в `shared/ui` на примитивах Radix, стили — Tailwind CSS 4, варианты — `cva`.

## Рассмотренные варианты

Material UI. Его стили по умолчанию — Emotion (CSS-in-JS в рантайме). Сборка в статический `.css` возможна
только через Pigment CSS, а он в alpha, и команда MUI приостановила его разработку. Требование
«CSS собирается в .css, а не в JS» и бюджет бандла ≤ 300 КБ gzip (PRD, раздел 10) вместе с ним не выполняются.

Radix + Tailwind совпадает со стеком PRD 11.1.
