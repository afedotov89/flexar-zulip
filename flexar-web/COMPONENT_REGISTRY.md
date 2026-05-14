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
  `--container-width-{xs,sm,md,lg}` (240/360/480/640 — max-width
  тултипов/модалок/контейнеров),
  `--duration-{fast,base,slow}`, `--shadow-{sm,md,lg}`,
  `--z-{base,dropdown,sticky,overlay,modal,popover,tooltip,toast}`,
  `--font-family-{base,mono}`.
- Цветовые роли (27, значения свет/тёмная — в `:root` / `:root[data-theme="dark"]`):
  `--color-accent`, `--color-accent-hover`, `--color-accent-active`,
  `--color-bg`, `--color-surface`, `--color-surface-raised`,
  `--color-text`, `--color-text-muted`, `--color-text-on-accent`,
  `--color-border`, `--color-border-strong`,
  `--color-danger`, `--color-danger-hover`,
  `--color-success`, `--color-success-hover`,
  `--color-warning`, `--color-warning-hover`,
  `--color-hover`, `--color-active`, `--color-focus-ring`,
  `--color-overlay-scrim` (подложка модалок),
  `--color-avatar-{1..5}` (палитра фонов аватаров — из `avatarMarble`).

---

## Примитивы UI (`src/components/`)

**20 примитивов, все ✅ (Фаза 0.6, протыканы через `/primitives`).**
Импорт из `src/components/<Name>`. Named export + `Props`-интерфейс.
Общий словарь: `ButtonVariant` (`primary|secondary|ghost|danger`) и
`ButtonSize` (`sm|md|lg`) — экспортятся из `Button`, переиспользуются
остальными размерными/вариантными примитивами. Все интерактивные
примитивы — `forwardRef` на нативный DOM-элемент.

| Компонент | Статус | Путь | Назначение / ключевые пропсы |
|---|---|---|---|
| Icon | ✅ | `src/components/Icon/` | SVG из `src/icons/`. `name: IconName`, `size`. 15 иконок. Декоративна по умолчанию. |
| Button | ✅ | `src/components/Button/` | `variant`, `size`, `loading`, `iconLeft/Right` (имя иконки), `fullWidth`, `disabled`. |
| IconButton | ✅ | `src/components/IconButton/` | Иконка-кнопка. `icon`, обяз. `aria-label`, `variant`, `size`, `loading`. |
| Input | ✅ | `src/components/Input/` | `size`, `invalid`, `iconLeft/Right` + нативные атрибуты `<input>`. |
| Textarea | ✅ | `src/components/Textarea/` | `invalid` + нативные атрибуты. `rows` по умолч. 3. |
| Select | ✅ | `src/components/Select/` | Стилизованный нативный `<select>`. `options: SelectOption[]`, `size`, `invalid`, `placeholder`. |
| Checkbox | ✅ | `src/components/Checkbox/` | `label`, `indeterminate`, `invalid` + нативные. `useId` для label. |
| Radio | ✅ | `src/components/Radio/` | `label`, `name`, `value` (обяз.), `invalid`. |
| Toggle | ✅ | `src/components/Toggle/` | Switch (`role="switch"`). `label` (обяз.), `size` (`ToggleSize` = `sm\|md`). |
| Avatar | ✅ | `src/components/Avatar/` | `src`, `name`, `size`. Фолбэк на инициалы; стабильный цвет из `--color-avatar-*` по хешу имени. |
| Badge | ✅ | `src/components/Badge/` | `variant` (`neutral\|accent\|danger`), `count`+`max` → `"99+"`, либо `children`. |
| Banner | ✅ | `src/components/Banner/` | `tone` (`info\|success\|warning\|danger` — 4 цвета + иконки), `title`, `onDismiss`. |
| Spinner | ✅ | `src/components/Spinner/` | Индикатор загрузки. `size`. `role="status"`. |
| Skeleton | ✅ | `src/components/Skeleton/` | `variant` (`text\|rect\|circle`), `width`, `height` (token-пресеты). |
| Divider | ✅ | `src/components/Divider/` | `orientation` (`horizontal\|vertical`), `spacing`. |
| Tabs | ✅ | `src/components/Tabs/` | `tabs`, `activeId`, `onChange`, `children: (activeId) => ReactNode`. WAI-ARIA, roving tabindex. |
| ScrollArea | ✅ | `src/components/ScrollArea/` | Стилизованный overflow-контейнер. `orientation`. Token-скроллбары. |
| Tooltip | ✅ | `src/components/Tooltip/` | `content`, `children` (триггер, клонируется), `placement`, `delay`. Hover+focus. |
| Popover | ✅ | `src/components/Popover/` | `trigger` (клонируется), `placement`, controlled/uncontrolled `open`. `role="dialog"`. |
| DropdownMenu | ✅ | `src/components/DropdownMenu/` | `trigger`, `items: DropdownMenuEntry[]`. На базе Popover. Клавиатура, `role="menu"`. |
| Modal | ✅ | `src/components/Modal/` | `open`, `onClose`, `title`, `footer`, `size`, `dismissable`. Focus-trap, scroll-lock, портал. |

**Внутренний хелпер overlay-семейства** — `src/components/_overlay/`
(не публичный примитив, используют Tooltip/Popover/DropdownMenu/Modal):
`Portal`, `useOverlayPosition` (+ `OverlayPlacement`), `useDismiss`,
`getTabbableElements`, `createFocusTrapHandler`. Позиционирование пишет
`--overlay-x/-y` императивно через ref (не JSX `style` — линт его
запрещает).

---

## Хуки (`src/lib/hooks/` и рядом с владельцами)

| Хук | Статус | Путь | Назначение |
|---|---|---|---|
| _(пока нет)_ | — | — | — |

---

## Сторы (`src/stores/`)

**Паттерн (задан `authStore`):** `create<State>()(...)` с явным
интерфейсом, бандлящим данные + экшены; `persist`-middleware только
когда стейт обязан переживать релоад; сайд-эффекты, которые должны
идти в ногу с persisted-стейтом — внутри экшенов, не в UI.

| Стор | Статус | Путь | Назначение |
|---|---|---|---|
| `useAuthStore` | ✅ | `src/stores/authStore.ts` | Сессия аутентификации. State: `session: AuthSession\|null`, `status: "unknown"\|"unauthenticated"\|"authenticated"`, `isLoggingIn`, `error`. Actions: `initialize()` (резолвит `"unknown"` — зовётся из `App` на маунте), `login(email,password)`, `logout()`. `persist` (ключ `flexar-hub-auth`, `partialize` → только `session`). Экспорты: `AuthSession`, `AuthStatus`, `AuthState`. |
| `useRealmStore` | ✅ | `src/stores/realmStore.ts` | `realm: Realm\|null`. Только гидрация из register-снапшота (realm-update события — в long-tail, пока не типизированы). |
| `useUsersStore` | ✅ | `src/stores/usersStore.ts` | `users: Record<UserId,User>`; `getUser(id)`. Гидрация + `realm_user` add/remove/update. |
| `useStreamsStore` | ✅ | `src/stores/streamsStore.ts` | `streams`, `subscriptions` (Record по `StreamId`); `getStream/getSubscription/isSubscribed`. Гидрация + `stream` + `subscription` события. |
| `useMessagesStore` | ✅ | `src/stores/messagesStore.ts` | `messages: Record<MessageId,Message>`, `flags: Record<MessageId,MessageFlag[]>`; `getMessage/getFlags`, `ingest(messages, flagsById?)` — **сюда пишет history-fetch Фазы 1.6**. Гидрация = пусто (снапшот без тел сообщений); re-register чистит кэш. События: message/update_message/delete_message/reaction/update_message_flags. |
| `usePresenceStore` | ✅ | `src/stores/presenceStore.ts` | `presences: PresenceMap`; `getPresence(id)`. Гидрация + `presence` события. |
| `useUnreadStore` | ✅ | `src/stores/unreadStore.ts` | `unread: Record<MessageId,true>`; `isUnread(id)`, `getUnreadCount()`. Гидрация + message/update_message_flags(`read`)/delete. |

**Без `persist`** (в отличие от `authStore`): server-state пере-фетчится
из `register` при каждом коннекте, не должен переживать релоад.
**Внутренние хелперы `src/stores/`** (не общие примитивы): `wireStore`
(контракт «подписка на `module-load`: hydrate из снапшота + applyEvent»),
`eventGuards` (нарроуинг `ServerEvent` мимо `UnknownEvent`), `*Reducer.ts`
(чистые редьюсеры, отдельно unit-покрыты).

---

## Утилиты (`src/lib/`)

| Утилита | Статус | Путь | Назначение |
|---|---|---|---|
| _(пока нет)_ | — | — | — |

---

## Доменные типы (`src/domain/`)

**Импортировать из `src/domain` (`index.ts` ре-экспортит всё).** Не
лезть в отдельные файлы. Типы заморожены — на них завязаны 0.4 и 1.x.

| Файл | Статус | Экспорты |
|---|---|---|
| `primitives.ts` | ✅ | `UserId`, `StreamId`, `MessageId`, `UnixTimestamp` (алиасы); `Role`, `BotType` (`as const` + тип; в index — значения как `RoleValues`/`BotTypeValues`); `GroupSettingValue` |
| `emoji.ts` | ✅ | `ReactionType`, `EmojiIdentity`, `Reaction`, `RealmEmoji`, `Draft` |
| `user.ts` | ✅ | `User`, `ProfileData`, `ProfileFieldValue`, `UserStatus`, `Presence`, `PresenceMap` |
| `stream.ts` | ✅ | `ChannelBase`, `ChannelPermissionGroups`, `Stream`, `Subscription`, `Topic`, `TopicVisibilityPolicy` (`as const` + тип) |
| `message.ts` | ✅ | `Message`, `MessageType`, `DisplayRecipient`, `DirectMessageRecipient`, `TopicLink`, `MessageEdit`, `Submessage`, `MessageFlag` |
| `narrow.ts` | ✅ | `Narrow`, `NarrowOperator`, `NarrowTerm`, `NarrowTuple` |
| `realm.ts` | ✅ | `Realm`, `OwnUser`, `ChannelFolder` |
| `events.ts` | ✅ | `ServerEvent` (дискр. объединение) + члены: `MessageEvent`, `UpdateMessageEvent`, `DeleteMessageEvent`, `ReactionEvent`, `UpdateMessageFlagsEvent`, `SubscriptionEvent` (+5 op-вариантов), `StreamEvent` (+3), `RealmUserEvent` (+3), `PresenceEvent`, `TypingEvent`, `TypingEventUser`, `UserStatusEvent`, `UserTopicEvent`, `HeartbeatEvent`, `UnknownEvent` |
| `index.ts` | ✅ | Ре-экспорт всей публичной поверхности |

**Объём событий — намеренно частичный:** точные формы у событий ядра чата;
длинный хвост (`realm`, `user_group`, `realm_emoji`, `drafts`,
`scheduled_messages` и т.п.) поглощается `UnknownEvent`. Понадобится
точная форма в 1.x — добавлять через оркестратора.

---

## API-клиент (`src/api/`)

**Единственная сетевая граница приложения (GUIDE §6).** Свой `fetch` —
запрещён. Импорт из `src/api`. Доменные сущности — из `src/domain`
(клиент их НЕ ре-экспортит).

| Артефакт | Статус | Описание |
|---|---|---|
| `ApiClient` / `createApiClient(credentials?)` | ✅ `src/api/client.ts` | Класс с изменяемым стейтом креденшелов; все методы эндпоинтов. |
| `ApiError` / `isApiError(v)` | ✅ `src/api/errors.ts` | Единый тип ошибки: `.code`, `.httpStatus`, `.body`. Кидается всеми методами. |
| Транспорт (`request.ts`, `narrow.ts`, `types.ts`) | ✅ | Внутренности: единственное место с `fetch`, кодирование параметров, `narrowToWire()`, envelope-типы. |

**Методы `ApiClient`:** `setCredentials` / `clearCredentials` /
`hasCredentials`; `fetchApiKey(username, password)` (без креденшелов);
`registerQueue(opts?)`; `getEvents(queueId, lastEventId)`;
`getMessages(opts)`; `sendMessage(params)`; `addReaction(msgId, r)` /
`removeReaction(msgId, r)`; `getSubscriptions()`; `getStreams(opts?)`;
`getUsers(opts?)`; `getOwnUser()`.

Realtime register/long-poll — это транспортные вызовы; цикл подписки и
диспатч событий (`src/realtime/`) — отдельная Фаза 1.2. TanStack
Query-хуки поверх клиента — позже, с фичами.

**Общий синглтон** — `apiClient` (`src/api/apiClient.ts`, ре-экспорт из
`src/api`): один разделяемый экземпляр `ApiClient` на всё приложение.
Создаётся без креденшелов; `authStore` их проставляет/сбрасывает.
Все консьюмеры (стор, будущие хуки/realtime) импортируют именно его.

---

## Realtime (`src/realtime/`)

**Слой соединения (1.2) — «труба».** Сторы server-state (1.3) подписы-
ваются на события через `realtimeConnection.subscribe(...)`.

| Артефакт | Статус | Путь | Назначение |
|---|---|---|---|
| `realtimeConnection` | ✅ | `src/realtime/lifecycle.ts` | App-wide синглтон `RealtimeConnection`. Сторы 1.3 зовут `.subscribe()` на нём. |
| `RealtimeConnection` | ✅ | `src/realtime/connection.ts` | register queue (с `fetchEventTypes`+`slimPresence`) → long-poll `getEvents` → диспатч; reconnect (exp backoff+jitter), re-register на `BAD_EVENT_QUEUE_ID`; `start/stop` (generation-token, чистый стоп). `subscribe(listener)` → событийный поток (без heartbeat, по порядку); `onInitialState(listener)` → register-снапшот (`InitialState`), шлётся на каждый (ре-)register **до** событий новой очереди; `onStatusChange`/`getStatus` (`idle\|connecting\|connected\|reconnecting`). |
| `wireRealtimeToAuth()` | ✅ | `src/realtime/lifecycle.ts` | Бинд lifecycle к `authStore.status` (start на `authenticated`, stop на logout). Зовётся из `App` на маунте. |
| `backoff.ts` / `events.ts` | ✅ | `src/realtime/` | Чистые хелперы: `backoffDelay`/`backoffBaseDelay`; `maxEventId`/`isHeartbeat`/`dropHeartbeats`. Unit-покрыты. |

**Контракт (закрыт в 1.3):** нет буфера/replay — подписываться на
`module-load` до `start()` (см. `wireStore`); initial state — через
`onInitialState` (вариант «б», решение оркестратора): register тянет
снапшот, сторы гидрируются из него и ре-гидрируются на re-register.

---

## App-shell и инфраструктура

| Артефакт | Статус | Путь | Назначение |
|---|---|---|---|
| Скаффолд (Vite/React/TS, гейты, dev-proxy) | ✅ | `flexar-web/` | Базовый проект, тулинг, Vite dev-proxy `/api` → стенд |
| Роут-таблица | ✅ | `src/app/routes.tsx` | `createBrowserRouter`: `/` → `RequireAuth` → `AppShell` (index → `Feed`); `/login` → `LoginPage`; `/showcase` → `TokenShowcase`; `/primitives` → `PrimitivesShowcase`; `*` → `NotFound`. |
| `RequireAuth` (guard) | ✅ | `src/app/RequireAuth/` | Гард авторизованных роутов. `"unknown"` → `Spinner`-загрузка (НЕ редиректит); `"unauthenticated"` → `Navigate` на `/login` (запоминает `from`); `"authenticated"` → `<Outlet/>`. |
| `LoginPage` (страница) | ✅ | `src/pages/LoginPage/` | Экран входа: форма email/password (примитивы `Input`/`Button`), ошибка через `Banner`. Зовёт `apiClient.fetchApiKey` через `authStore.login`. Standalone, вне `AppShell`. Авторизованного редиректит на `/`. |
| `PrimitivesShowcase` (страница) | ✅ | `src/pages/PrimitivesShowcase/` | Дев-витрина всех 20 примитивов в состояниях — для протыка. Роут `/primitives`. |
| `AppShell` | ✅ | `src/app/AppShell/` | Трёхколоночный каркас: `Navbar` + левый/правый `<aside>` + центральный `<main>` с `<Outlet/>`. Колонки — плейсхолдеры. Сайдбары схлопываются `display:none` при `width ≤ 768px`. |
| `Navbar` | ✅ | `src/app/Navbar/` | Верхний бар: бренд / слот поиска (плейсхолдер) / actions (тоггл темы + email сессии + logout-кнопка на `authStore.logout`). Тоггл темы — пока временный локальный `<button>`. |
| Провайдер-стек / `App` | ✅ | `src/app/App.tsx` | `ThemeProvider` → `QueryClientProvider` → `RouterProvider`; на маунте зовёт `authStore.initialize()` (резолвит `"unknown"`-статус). |
| `Feed` (страница) | ✅ | `src/pages/Feed/` | Плейсхолдер центральной ленты (index-роут). |
| `NotFound` (страница) | ✅ | `src/pages/NotFound/` | Плейсхолдер catch-all роута. |

**Зависимости, добавленные оркестратором (Фаза 0.5):** `react-router-dom`
(v7), `@tanstack/react-query` (v5) — оба из зафиксированного стека (GUIDE §1).

**Флаг для 1.x:** левый сайдбар сейчас `<aside>`-плейсхолдер; настоящий
`<nav>` со списком каналов встанет внутрь него в фичевой фазе. Тоггл темы
в навбаре — временный локальный `<button>`, заменить на `Button`/
`IconButton` после 0.6.
