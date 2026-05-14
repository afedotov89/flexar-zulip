# HANDOFF.md — Flexar Hub Web · состояние оркестрации

> Рабочий файл оркестратора. Обновляется **перед каждым переходом между
> фазами** (и при значимых решениях). Назначение — бесшовное продолжение
> в новой сессии без потери контекста.

**Последнее обновление:** 2026-05-14, после Фазы 0.5.

---

## Как продолжить (для новой сессии)

1. Прочитать в этом порядке: `PRD.md` → `ENGINEERING_GUIDE.md` →
   `COMPONENT_REGISTRY.md` → этот файл.
2. Проверить ветку: `git checkout flexar-web && git pull` (работаем
   только в `flexar-web/`, ветка `flexar-web`).
3. Продолжить с пункта «Следующее действие» ниже.
4. Модель работы — PRD §6: оркестратор не кодит, спавнит сабагентов по
   спекам, интегрирует, гоняет гейты, протыкивает в браузере, ведёт
   `COMPONENT_REGISTRY.md` и мастер-чеклист в `PRD.md`.

---

## Текущее состояние

- **Репозиторий:** `/Users/alexander/projects/flexar-zulip`, ветка
  `flexar-web` (от `origin/main`, запушена).
- **Каталог проекта:** `flexar-web/`. Менеджер пакетов — **npm**.
- **Фаза:** 0 (Фундамент). Сделано 0.1, 0.1a, 0.2, 0.3, 0.4, 0.5.
  **Следующее — 0.6.**

### Коммиты на ветке (свежие сверху)
- `1f19e5005b` 0.5 — app-shell (`src/app/`)
- `1eb6febbb3` 0.4 — API-клиент (`src/api/`)
- `6c7ba26fa6` 0.3 — доменные типы (`src/domain/`)
- `a4bb1f3af9` HANDOFF.md
- `a0e171b34c` 0.2 — токен-пайплайн
- `3706e6d245` 0.2-prep — semantic-шкалы в `tokens.ts`
- `ea7110a8eb` 0.1a — ENGINEERING_GUIDE + COMPONENT_REGISTRY
- `9219700191` 0.1 — скаффолд
- `c1ac5e6cc2` PRD + seed tokens

### Прогресс по мастер-чеклисту (детали — в `PRD.md` §10)
- [x] 0.1 Скаффолд — гейты зелёные, протыкан на :5173
- [x] 0.1a Механизм согласованности — гайд + реестр + линт
- [x] 0.2 Токен-пайплайн — 16 `--color-*` ролей + шкалы, ThemeProvider,
      витрина протыкана (свет/тёмная), 13 unit-тестов
- [x] 0.3 Доменные типы — 9 файлов в `src/domain/`, заморожены
      (`Message`/`Stream`/`User`/`Realm`/`Narrow`/`Reaction`/`Draft`/
      `Emoji`/`ServerEvent`-union); гейты зелёные
- [x] 0.4 API-клиент — `ApiClient`/`createApiClient`, `ApiError`,
      транспорт; auth/register/events/messages/reactions/subs/streams/
      users; 18 unit-тестов (мок `fetch`); гейты зелёные
- [x] 0.5 App-shell — провайдер-стек, `createBrowserRouter`, `AppShell`
      (3 колонки + `Navbar`), `Feed`/`NotFound`; протыкан (свет/тёмная,
      тоггл, роутинг); гейты зелёные. +deps: `react-router-dom`,
      `@tanstack/react-query`
- [ ] 0.6 Примитивы UI (20 шт., широкий параллелизм) ← **следующее**

---

## Следующее действие

**Фаза 0.6 — примитивы UI (`src/components/`).** 20 примитивов из
`COMPONENT_REGISTRY.md` (Button, IconButton, Input, Textarea, Select,
Checkbox, Radio, Toggle, Avatar, Badge, Spinner, Skeleton, Tooltip,
Popover, DropdownMenu, Modal, Tabs, Banner, Divider, Icon, ScrollArea).
**Широкий параллелизм:** разбить на несколько сабагентов по
независимым группам (см. ниже). Каждый примитив — `src/components/
<Name>/` (`Name.tsx` + `.module.css` + `.test.tsx` + `index.ts`),
named export, токены/CSS-Modules, все состояния (hover/focus-visible/
active/disabled/selected + loading/empty/error где применимо), свет/
тёмная, a11y. Сабагент обязан прочитать GUIDE + REGISTRY первой
строкой; не пересоздавать; границы — только своя группа.

Группировка для параллельных сабагентов (черновик, уточнить при
запуске; `Icon` — общий, делать первым/отдельно, остальные на него
опираются):
- A: Icon, Button, IconButton, Divider, Spinner, Skeleton
- B: Input, Textarea, Select, Checkbox, Radio, Toggle
- C: Avatar, Badge, Banner, Tabs, ScrollArea
- D: Tooltip, Popover, DropdownMenu, Modal (overlay-семейство)
Зависимость: B/C/D используют Icon и, возможно, Button/IconButton —
поэтому сначала сделать A (или хотя бы Icon+Button), затем B/C/D
параллельно. Заведена ли витрина (storybook-страница) для примитивов
— решить при запуске; протык 0.6 идёт через неё.

После 0.6: конец Фазы 0 → Фаза 1.

---

## Ключевые решения (не очевидные из docs)

- **Направление:** фронт с нуля поверх Zulip REST + events API; сервер
  Zulip и его `web/` не трогаем. CSS-ретема форка (PR #13 в `flexar/main`)
  упёрлась в потолок — отдельное, не влитое.
- **Размещение:** не отдельный репозиторий, а `flexar-web/` + ветка
  `flexar-web` в текущем репозитории (решение владельца).
- **`tokens.ts`:** копия из Flexar + добавленный мной слой `scales`
  (semantic-шкалы — их в исходнике не было; владелец одобрил «вариант 1
  — оркестратор задаёт шкалы»). Позже шкалы Flexar могут подтянуть под
  эти.
- **Принцип 10:** ноль ассетов/брендинга из Zulip и legacy-Flexar/RAGFlow.
- **Тест-окружение (PRD §7.4):** фронт локально на :5173, бэкенд —
  стенд `https://95.84.162.15:8843` через Vite dev-proxy (`secure:false`,
  `changeOrigin:true`). Без правок на сервере.
- **Тестовый аккаунт:** `a.fedotov@friflex.com` (user_id 8) — проверен,
  `fetch_api_key` отвечает `success`. Пароль — в gitignored `.env`,
  НЕ в репозитории. Рекомендована ротация (засветился в чате).

## Флаги/допущения сабагентов (принятые)

- 0.1: stylelint `selector-class-pattern: null` (camelCase под CSS
  Modules); `strict-value` с `ignoreValues` для `transparent` и т.п.
- 0.2: `tests/setup.ts` — стаб `window.matchMedia` (jsdom-гэп);
  токен-декларации инжектятся из TS (не хардкод в `global.css`), чтобы
  `tokens.ts` оставался единственным источником.

## Среда / гейты

- Гейты на каждом шаге: `npm run typecheck`, `npm run lint`,
  `npm run test`, `npm run build` — все зелёные.
- Браузер-протык — через Claude-in-Chrome на :5173, по `PRD.md` §7.1
  (включая эстетическую согласованность).
- Dev-сервер запускать в фоне для протыка, гасить после (`pkill -f vite`).
