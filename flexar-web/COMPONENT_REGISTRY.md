# COMPONENT_REGISTRY.md — Flexar Hub Web

**Живой реестр всего реализованного.** Ведёт **оркестратор**, обновляет
после каждой принятой интеграции. Сабагенты — **только читают**: перед
написанием кода проверь, не существует ли уже нужное; если существует —
**используй, не пересоздавай**. Нужно новое общее — флагни оркестратора.

Статус-метки: ✅ готово (И+протык) · 🚧 в работе · ⬜ не начато.

---

## Токены и тема (`src/theme/`)

**Импортировать из `src/theme/` (`src/theme/index.ts`).** Сырой
`tokens.ts` в компонентах напрямую НЕ импортируется.

| Артефакт | Статус | Описание / экспорт |
|---|---|---|
| `tokens.ts` (источник) | ✅ | Flexar-слой (бренд-цвета light/dark) + `scales` (semantic-шкалы). Не импортируется компонентами напрямую. |
| `ThemeProvider` | ✅ `src/theme/ThemeProvider.tsx` | Оборачивает приложение; инжектит сгенерированный стайлшит в `<head>`, ставит `data-theme` на `<html>`, persist в `localStorage`, на старте — `prefers-color-scheme`. |
| `useTheme()` | ✅ `src/theme/useTheme.ts` | `{ theme: 'light'\|'dark'; setTheme(t); toggleTheme() }`. Бросает вне провайдера. |
| `theme.ts` | ✅ `src/theme/theme.ts` | Типизированная тема: `ColorRoles`, `lightTheme`, `darkTheme`, `themes`, ре-экспорт `scales`. |
| `cssVariables.ts` | ✅ `src/theme/cssVariables.ts` | Генерация CSS-переменных: `scaleVariableDeclarations()`, `colorVariableDeclarations(theme)`, `buildThemeStylesheet()`. |
| `global.css` | ✅ `src/theme/global.css` | Единственный разрешённый глобальный CSS: reset + дефолты документа. |

**CSS-переменные (использовать в CSS Modules через `var(--…)`):**
- Шкалы (в `:root`, тема-независимые): `--space-{0,1,2,3,4,5,6,8,10,12}`,
  `--radius-{sm,md,lg,xl,full}`, `--font-size-{xs,sm,md,lg,xl,2xl}`,
  `--font-weight-{regular,medium,semibold,bold}`,
  `--line-height-{tight,normal,relaxed}`,
  `--letter-spacing-{normal,wide}`, `--control-height-{sm,md,lg}`,
  `--duration-{fast,base,slow}`, `--shadow-{sm,md,lg}`,
  `--z-{base,dropdown,sticky,overlay,modal,popover,tooltip,toast}`,
  `--font-family-{base,mono}`.
- Цветовые роли (16, значения свет/тёмная — в `:root` / `:root[data-theme="dark"]`):
  `--color-accent`, `--color-accent-hover`, `--color-accent-active`,
  `--color-bg`, `--color-surface`, `--color-surface-raised`,
  `--color-text`, `--color-text-muted`, `--color-text-on-accent`,
  `--color-border`, `--color-border-strong`,
  `--color-danger`, `--color-danger-hover`,
  `--color-hover`, `--color-active`, `--color-focus-ring`.

---

## Примитивы UI (`src/components/`)

| Компонент | Статус | Путь | Краткое назначение / ключевые пропсы |
|---|---|---|---|
| Button | ⬜ | — | — |
| IconButton | ⬜ | — | — |
| Input | ⬜ | — | — |
| Textarea | ⬜ | — | — |
| Select | ⬜ | — | — |
| Checkbox | ⬜ | — | — |
| Radio | ⬜ | — | — |
| Toggle | ⬜ | — | — |
| Avatar / UserAvatar | ⬜ | — | — |
| Badge / Counter | ⬜ | — | — |
| Spinner | ⬜ | — | — |
| Skeleton | ⬜ | — | — |
| Tooltip | ⬜ | — | — |
| Popover | ⬜ | — | — |
| DropdownMenu | ⬜ | — | — |
| Modal / Dialog | ⬜ | — | — |
| Tabs | ⬜ | — | — |
| Banner / Alert | ⬜ | — | — |
| Divider | ⬜ | — | — |
| Icon | ⬜ | — | — |
| ScrollArea | ⬜ | — | — |

---

## Хуки (`src/lib/hooks/` и рядом с владельцами)

| Хук | Статус | Путь | Назначение |
|---|---|---|---|
| _(пока нет)_ | — | — | — |

---

## Сторы (`src/stores/`)

| Стор | Статус | Путь | Назначение |
|---|---|---|---|
| _(пока нет)_ | — | — | — |

---

## Утилиты (`src/lib/`)

| Утилита | Статус | Путь | Назначение |
|---|---|---|---|
| _(пока нет)_ | — | — | — |

---

## Доменные типы (`src/domain/`)

| Тип | Статус | Путь | Назначение |
|---|---|---|---|
| _(пока нет — Фаза 0.3)_ | — | — | — |

---

## API-клиент (`src/api/`)

| Метод | Статус | Назначение |
|---|---|---|
| _(пока нет — Фаза 0.4)_ | — | — |

---

## Realtime (`src/realtime/`)

| Артефакт | Статус | Назначение |
|---|---|---|
| _(пока нет — Фаза 1.2)_ | — | — |

---

## App-shell и инфраструктура

| Артефакт | Статус | Путь | Назначение |
|---|---|---|---|
| Скаффолд (Vite/React/TS, гейты, dev-proxy) | ✅ | `flexar-web/` | Базовый проект, тулинг, Vite dev-proxy `/api` → стенд |
| App-shell (3 колонки, навбар) | ⬜ | — | Фаза 0.5 |
