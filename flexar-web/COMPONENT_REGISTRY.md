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
| Icon | ✅ | `src/components/Icon/` | SVG из `src/icons/`. `name: IconName`, `size`. 21 иконка (+6 для built-in-видов в 1.5a). Декоративна по умолчанию. |
| PresenceDot | ✅ | `src/components/PresenceDot/` | Индикатор присутствия (active/idle/offline). Промоутнут из leftSidebar в 1.8 — общий для обоих сайдбаров. |
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
| `useCurrentNarrow()` | ✅ | `src/lib/narrow/` | Текущий `Narrow` из URL; `undefined` вне narrow-пространства, малформ → `[]`. |
| `useCurrentView()` | ✅ | `src/lib/narrow/` | Текущий `BuiltinView` из URL (спец-вид по path, narrow-вид по deep-equal). |
| `useNarrowNavigation()` | ✅ | `src/lib/narrow/` | `{ goToNarrow(narrow), goToView(view) }` — типизированная навигация. |
| `useRealtimeStatus()` / `useStoresLoading()` | ✅ | `src/lib/hooks/useRealtimeStatus.ts` | Биндинг к статусу `realtimeConnection` (`useSyncExternalStore`); `useStoresLoading` → `true` пока сторы не гидрированы. Общий для сайдбаров. |

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
| `useUnreadStore` | ✅ | `src/stores/unreadStore.ts` | **Бакетированный** (1.5): `unread: UnreadBuckets` (`channels: streamId→topic→ids`, `dms: convKey→ids`, `mentions: ids` [1.5a], `location`-обратный индекс). Селекторы: `isUnread`, `getUnreadCount`, `getChannelUnread(streamId)`, `getTopicUnread(streamId,topic)`, `getDmUnread(convKey)`, `getDmConversationKeys()`, `getMentionsCount()`. `convKey` = отсортированные user-id через `,`, включая себя. Гидрация из `unread_msgs` + message/update_message(move)/update_message_flags(`read`)/delete. Чистые экв-ты — в `unreadReducer.ts`. |
| `useDmConversationsStore` | ✅ | `src/stores/dmConversationsStore.ts` | Полный список ЛС-бесед (1.5a): `conversations: DmConversation[]` (`{conversationKey, participantIds, maxMessageId}`), `getConversations()` (recency-сортировка). Гидрация из `recent_private_conversations` + `message`-события. |
| `useDraftsStore` | ✅ | `src/stores/draftsStore.ts` | Драфты compose-бокса (2.4). State: `drafts: Record<key,Draft>`. `Draft={key,destination,content,updatedAt}`; `destination={type:"channel",streamId,topic} \| {type:"direct",recipientIds}`. Actions: `saveDraft`/`deleteDraft`/`getDraft`/`listDrafts`. `persist` в `localStorage` (ключ `flexar-hub-drafts`), `partialize` → только `drafts`. Чистые редьюсеры — в `draftsReducer.ts`. |
| `useTopicsStore` | ✅ | `src/stores/topicsStore.ts` | Топики по каналам (1.5a, ленивая загрузка): `topicsByChannel: Record<StreamId,Topic[]>`, `loadStatus`; `loadTopics(streamId)` (идемпотентна, через `apiClient.getTopics`), `getTopics(streamId)`, `getLoadStatus(streamId)`. На re-register кэш чистится. |

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
| narrow-кодек | ✅ | `src/lib/narrow/scheme.ts` | `narrowToPath(narrow, resolveChannelSlug?)` ↔ `parseNarrowPath(path): NarrowParseResult`. Чистый, round-trip-корректный. |
| built-in views | ✅ | `src/lib/narrow/builtinViews.ts` | `BUILTIN_VIEWS`, `SPECIAL_VIEWS`, `getBuiltinView(id)`; типы `BuiltinView` (`NarrowView\|SpecialView`, с полем `icon`), `BuiltinViewId`. |
| `matchesNarrow` | ✅ | `src/lib/narrow/matchesNarrow.ts` | Чистый предикат `matchesNarrow(message, narrow, ctx)` — для live-reconcile ленты. Оценивает channel/topic/dm/sender/`is:`; неразрешимые операторы (search/has/near/…) — пермиссивно. |
| renderedContent | ✅ | `src/lib/renderedContent/` | `sanitizeRenderedContent(html)` — XSS-граница (DOMPurify, строгий allowlist; 20 тестов); `parseNarrowLink(href, realmUrl)` — детект in-app narrow-ссылок Zulip → `Narrow`. |
| `presence` | ✅ | `src/lib/presence.ts` | Чистый хелпер свежести присутствия (active/idle/offline из `Presence`). Промоутнут из leftSidebar в 1.8. |
| emoji corpus | ✅ | `src/lib/emoji/` | Бандленный набор `EMOJI_CORPUS` (140 шортов → glyph) для `:` typeahead в compose. Кастомные realm emoji — отдельная фаза. |

**URL-схема narrow** (path-based, корень `/narrow`; импорт из
`src/lib/narrow`): сегменты `/<op>/<operand>` парами; пустой narrow =
`/narrow`. `channel` — `<id>` или `<id>-<slug>` (slug декоративен);
`dm` — отсортированные user-id через `,`; negated-term — префикс
`not-`. Спец-виды (не narrow): `/inbox`, `/recent`, `/drafts`.
Narrow-виды: Combined `/narrow`, Mentions `/narrow/is/mentioned`,
Starred `/narrow/is/starred`, Reactions `/narrow/has/reaction/sender/me`.

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
`getUsers(opts?)`; `getOwnUser()`; `getTopics(streamId)` → `Topic[]` (1.5a);
`renderMarkdown(content)` → `string` (HTML, 2.1+2.2).

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
| Роут-таблица | ✅ | `src/app/routes.tsx` | `createBrowserRouter`: `/` → `RequireAuth` → `AppShell` (index + `/narrow/*` + `/inbox`/`/recent`/`/drafts` → `Feed`); `/login` → `LoginPage`; `/showcase` → `TokenShowcase`; `/primitives` → `PrimitivesShowcase`; `*` → `NotFound`. Narrow/спец-вид роуты синхронизированы с `src/lib/narrow`. |
| `RequireAuth` (guard) | ✅ | `src/app/RequireAuth/` | Гард авторизованных роутов. `"unknown"` → `Spinner`-загрузка (НЕ редиректит); `"unauthenticated"` → `Navigate` на `/login` (запоминает `from`); `"authenticated"` → `<Outlet/>`. |
| `LoginPage` (страница) | ✅ | `src/pages/LoginPage/` | Экран входа: форма email/password (примитивы `Input`/`Button`), ошибка через `Banner`. Зовёт `apiClient.fetchApiKey` через `authStore.login`. Standalone, вне `AppShell`. Авторизованного редиректит на `/`. |
| `PrimitivesShowcase` (страница) | ✅ | `src/pages/PrimitivesShowcase/` | Дев-витрина всех 20 примитивов в состояниях — для протыка. Роут `/primitives`. |
| `AppShell` | ✅ | `src/app/AppShell/` | Трёхколоночный каркас: `Navbar` + левый/правый `<aside>` + центральный `<main>` с `<Outlet/>`. Колонки — плейсхолдеры. Сайдбары схлопываются `display:none` при `width ≤ 768px`. |
| `Navbar` | ✅ | `src/app/Navbar/` | Верхний бар: бренд / слот поиска (плейсхолдер) / actions (тоггл темы + email сессии + logout-кнопка на `authStore.logout`). Тоггл темы — пока временный локальный `<button>`. |
| Провайдер-стек / `App` | ✅ | `src/app/App.tsx` | `ThemeProvider` → `QueryClientProvider` → `RouterProvider`; на маунте зовёт `authStore.initialize()` (резолвит `"unknown"`-статус). |
| `Feed` (страница) | ✅ | `src/pages/Feed/` | Центр-колонка для narrow/index-роутов: монтирует `MessageFeed` (index `/` → Combined feed); Drafts-вид → `Drafts`; Inbox/Recent — плейсхолдер. |
| `Drafts` (страница) | ✅ | `src/pages/Drafts/` | Список драфтов (2.4): destination-лейбл (`# канал > топик` / DM), preview, timestamp, X-удаление; клик → `goToNarrow` (compose восстанавливает текст). Empty-state. **Live-протык на стенде — ✅ (драфт сохранён → переход → восстановлен).** |
| `NotFound` (страница) | ✅ | `src/pages/NotFound/` | Плейсхолдер catch-all роута. |

**Зависимости, добавленные оркестратором:** `react-router-dom` (v7),
`@tanstack/react-query` (v5) — из стека GUIDE §1 (0.5); `zustand` (v5) —
из стека (1.1); `@tanstack/react-virtual` (v3) — виртуализация ленты,
пред-одобрено (1.6); `dompurify` (v3) — санитайз `rendered_content`,
пред-одобрено (1.7).

**Конфиг (1.7):** в `.stylelintrc.json` добавлен
`selector-pseudo-class-no-unknown: ignorePseudoClasses [global, local]` —
GUIDE требует `:global()` для стилей серверного HTML; стандартный
CSS-Modules-фикс.

**Флаг для 1.x:** тоггл темы в навбаре — временный локальный `<button>`,
заменить на `Button`/`IconButton` позже.

---

## Доменные блоки (`src/features/`)

| Фича | Статус | Путь | Назначение |
|---|---|---|---|
| `LeftSidebar` | ✅ | `src/features/leftSidebar/` | Левая навигация: секция ВИДЫ (`BUILTIN_VIEWS`, с иконками), полный список ЛС (`dmConversationsStore`), список каналов с полными топиками (`topicsStore`, ленивая загрузка на раскрытии; сворачивание per-channel и per-section), счётчики непрочитанного (`unreadStore`-бакеты, у Mentions — `getMentionsCount`), фильтр-инпут, кнопка «+» (пока no-op). Навигация — `useNarrowNavigation`; активный пункт — `useCurrentView`/`useCurrentNarrow`; loading — по статусу `realtimeConnection`. Смонтирован в левый `<aside>` `AppShell`. Per-channel цвет — через CSS-var-ref. |
| `MessageFeed` | ✅ | `src/features/messageFeed/` | Центральная лента (1.6): виртуализированный список (`@tanstack/react-virtual`), recipient-бары (канал›топик / ЛС), дата-разделители, строка сообщения (аватар/отправитель/время/контент/hover-тулбар), группировка последовательных сообщений, состояния loading/empty/error, дозагрузка старых/новых по скроллу. Читает narrow из `useCurrentNarrow`, тянет историю `apiClient.getMessages` → `messagesStore.ingest`, живые события — из `messagesStore`; `useFeedWindow` владеет per-narrow окном (порядок ids + пагинация + live-reconcile через `matchesNarrow`). `MessageContent` (1.7) — рендерит `rendered_content`: DOMPurify-санитайз → `dangerouslySetInnerHTML` → event-delegation (спойлеры toggle, narrow-ссылки → router, внешние → `_blank rel=noopener`). Стили — `:global()` под root-классом, токены, свет/тёмная. Смонтирован в `src/pages/Feed/`. |
| `RightSidebar` | ✅ | `src/features/rightSidebar/` | Правая колонка (1.8): список пользователей с `PresenceDot`, контекстная секция «в этом канале»/«в этом разговоре» (из `useCurrentNarrow`) + полный справочник, фильтр пользователей, loading-скелетоны. Сортировка: presence-группы → боты → деактивированные, внутри — алфавит. Смонтирован в правый `<aside>` `AppShell`. |
| `ComposeBox` | ✅ | `src/features/compose/` | Compose-бокс (Фаза 2.1–2.4): пре-фил из текущего narrow (channel+topic / DM / hint для empty), автоувеличивающийся `Textarea`, Write/Preview-табы (preview через `apiClient.renderMarkdown` + санитайз), отправка через `apiClient.sendMessage` с **оптимистичным эхо** в `messagesStore` и реконсиляцией по `message`-событию (отрицательные local-id, race-safe). Enter — send, Shift+Enter — newline. Failure → `Banner`. **Typeahead** (`src/features/compose/typeahead/`): `@` (юзеры), `#` (каналы), `:` (эмодзи — bundled corpus 140 шортов), топики; bespoke `TypeaheadPanel`, фокус остаётся на textarea, `aria-activedescendant`/`role=listbox`. **Drafts**: автосохранение в `useDraftsStore` (debounce 500ms, key per-destination), удаление при опустошении/отправке, восстановление при возврате в тот же контекст с «Restored from draft»-хинтом. Смонтирован под `MessageList`. **Live-протык на стенде ✅** (отправка, все 3 типахеда, сохранение/восстановление драфта). |

**Доборка 1.5a — закрыто:** иконки видов, `dmConversationsStore`,
`topicsStore`+`getTopics`, `mentions`-бакет. Остаток: бейдж Starred —
осознанно нет (нет понятия «непрочитанное отмеченное»); wildcard-
mentions в live-`message`-пути не считаются (снапшот их учитывает).
