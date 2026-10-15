# ADR-0002. ESLint + Prettier вместо Biome

Дата: 2026-10-16 · Статус: принято

## Контекст

PRD 18.1 называет Biome линтером для TypeScript.

## Решение

ESLint (flat config, typescript-eslint strict type-checked) и Prettier.

## Почему

- Правила слоёв FSD: `eslint-plugin-boundaries` и `no-restricted-imports` проверяют направление импортов
  и публичный API слайсов. У Biome такой проверки нет.
- Правила, которых нет в Biome: type-aware typescript-eslint, `react-hooks` (включая правила React Compiler), `jsx-a11y`.
- `prettier-plugin-tailwindcss` сортирует классы Tailwind.

Цена: линт медленнее, чем у Biome. Пока это секунды — не проблема.
