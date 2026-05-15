# HANDOFF.md — Flexar Hub Web · состояние оркестрации

> Рабочий файл оркестратора. Обновляется **перед каждым переходом между
> фазами** (и при значимых решениях). Назначение — бесшовное продолжение
> в новой сессии без потери контекста.

**Последнее обновление:** 2026-05-15, **Фаза 4.4 закрыта** (user status: текст + эмодзи, редактор в navbar, отображение в правом сайдбаре).

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
- **Фаза:** Фаза 0 завершена. Фаза 1 — **1.1–1.8 сделаны (фиче-комплит)**.
  **Следующее — гейт Фазы 1** (см. «Следующее действие»).

### Коммиты на ветке (свежие сверху)
- `d39eeb6234` 4.4 — user status (текст+эмодзи, navbar editor, right sidebar)
- `ff0d1dee97` HANDOFF — 4.1 заметка
- `6f5d210c68` 4.1 — загрузки файлов (XHR-транспорт + paperclip/paste/drag-drop, прогресс, Markdown-вставка)
- `ef71763250` HANDOFF — 4.5 заметка
- `e3465b6b0d` 4.5 — отложенные сообщения (API + store + popover + /scheduled)
- `3e566ce6c5` 4.6 — edit-history viewer (modal in actions menu)
- `f4fc972afb` HANDOFF — fill in 4.3 commit hash
- `e61e606763` 4.3 — typing indicators (send + receive), live POST /typing ✅
- `8b8eca0070` HANDOFF — fill in 3.1 commit hash
- `85b91cda8f` 3.1 — search bar (parser + Navbar input → narrow), live ✅
- `7a4a3c839b` HANDOFF — fill in 3.5 commit hash
- `6304de67c0` 3.5 — уведомления (desktop Notification API + Web Audio sound + dispatcher)
- `9b3803d07d` HANDOFF — fill in 3.6 commit hash
- `ded70d7141` 3.6 — эмодзи-пикер для compose + кастомные realm-эмодзи store, live ✅
- `ed7a002dfc` HANDOFF — fill in 3.4 commit hash
- `0fd37adc0c` 3.4 — управление непрочитанным (mark-as-read on scroll + mark-all-read), live ✅
- `1fb0da3b55` 3.3 — действия над сообщением (меню+edit+delete+star+copy+mark-unread), live ✅
- `36b79f1131` 3.2 — реакции (чипы + `ReactionPicker` + optimistic, live-протык ✅)
- `43c5fd6cad` 2.4 — драфты (`useDraftsStore` + автосохранение + восстановление + `/drafts`-страница, +фикс ререндера destination-лейбла), live-протык ✅
- `1563e06ea3` 2.3 — typeahead (@юзеры/#каналы/:эмодзи/топики), live-протык ✅
- `fa7f320e0d` 2.1+2.2 — compose-бокс + send (live-протык: ✅ сообщение отправлено)
- `2723e343a2` 1.7-fix — unicode emoji decorator (live-protyk finding)
- `f9b992d91c` 1.8 — правый сайдбар + промоут `PresenceDot`/хука
- `294c4b9a69` 1.7 — рендер контента сообщений
- `2813c19ab7` 1.6a — таймаут запросов `apiClient`
- `6dbb6a7199` 1.6 — лента сообщений (`src/features/messageFeed/`)
- `13214aaaae` 1.5a — доборка данных сайдбара
- `56fcfc337c` 1.5 — левый сайдбар + бакетированный `unreadStore`
- `ec57997948` 1.4 — роутинг/narrow (`src/lib/narrow/`)
- `730acde285` 1.3 — сторы server-state + initial-state канал
- `68d660c75b` 1.2 — цикл событий (`src/realtime/`)
- `d08feb62c0` 1.1 — аутентификация (стор, логин, guard, autologin)
- `eafe687600` 0.6-чеклист — отметка Фазы 0 в PRD §10
- `27421c5d8b` 0.6 — 20 примитивов UI + витрина + token-доборка
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
- [x] 0.6 Примитивы UI — 20 примитивов (4 группы параллельно) +
      `_overlay`-хелпер + витрина `/primitives` + token-доборка
      (container-width, success/warning, overlay-scrim, avatar-палитра,
      3 иконки). Протыканы все, вкл. overlay-позиционирование и Modal;
      177 unit-тестов; гейты зелёные. **← Фаза 0 завершена**
- [x] 1.1 Аутентификация — `apiClient`-синглтон, `useAuthStore` (+`persist`),
      `LoginPage`, `RequireAuth`-guard, autologin, logout в навбаре;
      199 unit-тестов; гейты зелёные. Протык: экран логина + редирект +
      фикс бага гидрации — ✅; **живой вход на стенд — ⏳ ждёт владельца**
      (нужен ввод пароля руками, см. флаги).
- [x] 1.2 Цикл событий — `src/realtime/`: `RealtimeConnection` (register
      → long-poll → диспатч, reconnect/backoff, re-register на queue-
      expiry, чистый stop), `realtimeConnection`-синглтон,
      `wireRealtimeToAuth()`; 236 unit-тестов (мок `apiClient`); гейты
      зелёные. **Живой протык «события приходят» — ⏳ с владельцем.**
- [x] 1.3 Сторы server-state — 6 сторов (realm/users/streams/messages/
      presence/unread) + чистые редьюсеры; `RealtimeConnection`
      расширен каналом `onInitialState` (вариант «б»); хелперы
      `wireStore`/`eventGuards`; 337 unit-тестов; гейты зелёные.
      Живой протык — ⏳ с владельцем.
- [x] 1.4 Роутинг/narrow — `src/lib/narrow/`: чистый кодек narrow↔URL
      (path-based, round-trip), реестр built-in-видов, хуки
      `useCurrentNarrow`/`useCurrentView`/`useNarrowNavigation`;
      narrow/спец-вид роуты в `AppShell`; 399 unit-тестов; гейты зелёные.
- [x] 1.5 Левый сайдбар — `src/features/leftSidebar/` (виды/ЛС/каналы
      +топики, сворачивание, фильтр, счётчики); `unreadStore`
      реструктурирован в бакетированный; гейты зелёные.
      Протык: структура + skeleton-loading + интеграция в shell — ✅;
      populated-состояние — ⏳ с владельцем.
- [x] 1.5a Доборка данных сайдбара — иконки 7 видов, `dmConversationsStore`,
      `topicsStore`+`apiClient.getTopics`, `mentions`-бакет; всё
      подключено в сайдбар; 472 unit-теста; гейты зелёные.
- [x] 1.6 Лента сообщений — `src/features/messageFeed/`: виртуализация
      (`@tanstack/react-virtual`), recipient-бары, дата-разделители,
      строка+группировка, hover-тулбар, дозагрузка по скроллу,
      loading/empty/error; `useFeedWindow` + `matchesNarrow`; 551
      unit-тест; гейты зелёные. Протык: интеграция в shell + loading-
      скелетоны + корректный `getMessages`-запрос — ✅; populated/empty/
      error — ⏳ с владельцем (стенд из этого окружения не отвечает).
      +1.6a: таймаут запросов `apiClient` (флаг закрыт).
- [x] 1.7 Рендер контента — `MessageContent` рендерит `rendered_content`:
      DOMPurify-санитайз (строгий allowlist — XSS-граница, 20 тестов),
      event-delegation (спойлеры, narrow/внешние ссылки), CSS под все
      классы серверного HTML (код/KaTeX/эмодзи/меншены/спойлеры/таблицы).
      Код и KaTeX — CSS-only поверх pre-rendered-разметки. 593 unit-теста;
      гейты зелёные. Живой протык — ⏳ с владельцем.
- [x] 1.8 Правый сайдбар — `src/features/rightSidebar/`: список юзеров
      с presence, контекстные секции (канал/беседа из narrow), фильтр,
      loading; `PresenceDot`→примитив, `presence`→`src/lib/`,
      `useRealtimeStatus`→`src/lib/hooks/` (дедуп); 632 unit-теста;
      гейты зелёные. Живой протык — ⏳ с владельцем.
      **→ Фаза 1 фиче-комплит.**

---

## Следующее действие

**Гейт Фазы 1 — пройден.** Live-протык на стенде (`a.fedotov@friflex.com`)
прошёл сквозным сценарием: вход → register → события → 3 живые
колонки (виды/каналы/топики, лента с реальными сообщениями, юзеры с
presence) → narrow-навигация (channel, channel+topic, view) → in-app
narrow-ссылки → фильтры → темы → logout/autologin. Find-and-fix:
unicode emoji (коммит `2723e343a2`).

**Фаза 2 — фиче-комплит** (PRD §8 ФАЗА 2). **Live-протык на стенде ✅:**
- ✅ **2.1+2.2** — Compose-бокс + send. Сообщение «Test from Flexar Hub
  Web» отправлено в `# общее > приветствие`, появилось в ленте.
- ✅ **2.3 Typeahead** — `@a` дал 3 юзера, `#о` дал 2 канала,
  `:sm` дал 😄/😏/😅.
- ✅ **2.4 Черновики** — драфт сохранён → переход в `/drafts` показал
  его как «# общее > приветствие / Draft for testing autosave» →
  клик восстановил в compose с хинтом «Restored from draft».
- 788 unit-тестов; гейты зелёные.

**Фаза 3 — частично:**
- ✅ **3.2 Реакции** — чипы + `ReactionPicker` (поиск + grid-keyboard) +
  optimistic + revert + viewer-active подсветка. Live ✅: добавлено
  🚀 на сообщение Welcome Bot, чип появился.
- ✅ **3.3 Действия (частично)** — `MessageActionsMenu` на toolbar:
  Star/Unstar, Copy link, Mark unread; **Edit** (own only — inline,
  `getRawContent`→Textarea→Save+Ctrl+Enter, optimistic+revert),
  **Delete** (own only — confirm Modal, optimistic+restore). Новые
  методы apiClient: `editMessage`/`deleteMessage`/`updateMessageFlags`/
  `getRawContent`. Live ✅: меню открылось, Star→Unstar флип. Out of
  scope (на 3.3-extension): move/resolve topic, view source,
  quote-reply. 902 unit-теста.
- ✅ **3.4 Управление непрочитанным** — `apiClient.markAllAsRead`/
  `markStreamAsRead`/`markTopicAsRead`; `useUnreadStore.markRead`/
  `markAllRead` + чистый `markIdsRead`-редьюсер; `useMarkVisibleAsRead`
  (виртуализатор → видимые ряды → дебаунс 600мс → bulk
  `updateMessageFlags add read`, гейт по `document.visibilityState`,
  фильтр negative-id); `MarkAsReadButton` контекст-aware («Mark all/
  channel/topic as read» — показывается только при ненулевом счётчике
  scope-а, скрывается на DM/search/has/negated narrow). Live ✅:
  combined-feed → кнопка появилась → клик → unread очищены, кнопка
  скрылась, ошибок в консоли нет; channel-narrow без unread → кнопки
  нет (правильно). 915 unit-тестов.
- ✅ **3.6 Эмодзи** — `useRealmEmojiStore` (гидрация из `realm_emoji`
  снапшота, селекторы `getByName`/`listActive`, `realm_emoji` добавлен
  в `DEFAULT_EVENT_TYPES` для register); `ComposeEmojiPicker` (Popover
  + поиск + 8-колоночная сетка с unicode-corpus и realm-эмодзи через
  `<img>`; keyboard navigation как в ReactionPicker); `EmojiPickerButton`
  (smiley IconButton в `actionsRow` ComposeBox); `insertAtCursor` в
  ComposeBox для вставки `:shortcode:` в textarea на каретку. Live ✅:
  открыл пикер → нашёл `fire` → клик → `:fire:` вставился в textarea
  на позицию каретки, popover закрылся, фокус вернулся в textarea.
  924 unit-теста.
- ✅ **3.5 Уведомления** — `src/lib/notifications/`: чистый
  `notificationTriggerFor(message, flags, ownUserId)` (mention vs DM,
  гасит own-messages, поддерживает `mentioned`/`wildcard_mentioned`/
  `stream_wildcard_mentioned`/`topic_wildcard_mentioned`),
  `requestPermission/showDesktopNotification` (graceful no-op без
  Notification API / без grant), `playNotificationSound` (Web Audio
  синтезированный двух-тоновый блип, без зависимости на ассетах).
  Диспатчер `NotificationCenter` в `AppShell` подписан на
  realtime-events, фильтрует через trigger, гасит при visible+focused
  табе, шлёт title/body с именами sender'а и channel>topic, click →
  `goToNarrow` в conversation. 933 unit-теста. Live: компонент
  смонтирован, Notification API детектится, permission запрашивается
  на маунте (в Chrome-под-управлением промпт не показывается — это
  ограничение автоматизации; будет работать в обычном браузере).
- ✅ **3.1 Поиск** — `src/lib/search/parseQuery.ts` (чистый парсер
  Zulip-flavored синтаксиса: `from:`/`sender:`, `channel:`/`stream:`,
  `topic:`, `dm:`/`pm-with:`, `dm-including:`, `is:`, `has:`, `near:`,
  `id:`; шорт-форма `-` для negated; double-quoted значения; numeric
  user-id list для dm; bare-text → одно `search`-term; неизвестные
  операторы → free-text); `SearchBar` в navbar (Input + onSubmit →
  `parseSearchQuery` → `goToNarrow`). 11 unit-тестов. Live ✅:
  `is:starred` → URL `/narrow/is/starred`, MessageFeed re-fetch,
  результаты показаны.

**🎯 Фаза 3 фиче-комплит** — 3.1+3.2+3.3+3.4+3.5+3.6 закрыты.

### Фаза 4 — частично:
- ✅ **4.3 Typing-индикаторы** — `apiClient.sendTyping`; `useTypingStore`
  (бакеты `dm:<sortedIds>` / `channel:<id>:<topic>`, gate на own-sender,
  TTL ~15с, чистый pruneStale-редьюсер); `TypingIndicator` над compose
  (`useTypingFor(narrow)` + `formatTypingNames` 1/2/N+others);
  `useTypingEmitter` в ComposeBox (debounced start/stop, idle-stop 5с,
  flush на send/destination-change/unmount). 958 unit-тестов. Live ✅:
  набор текста в textarea → `POST /api/v1/typing` ушёл единожды
  (debounced).
- ✅ **4.6 История правок** — `apiClient.getMessageHistory(id)`;
  `EditHistoryModal` (Modal с list edit-snapshots: автор, timestamp,
  summary через `summariseEntry` [content / topic-move / channel-move /
  multiple], collapsible diff с prev_content); пункт "View edit
  history" в `MessageActionsMenu` гейтнут на `last_edit_timestamp !==
  undefined`; fetch на open, cancel на close, error через Banner.
  966 unit-тестов.
- ✅ **4.5 Отложенные сообщения** — `apiClient.getScheduledMessages`/
  `createScheduledMessage`/`updateScheduledMessage`/
  `deleteScheduledMessage`; `useScheduledMessagesStore` (lazy fetch +
  realtime add/update/remove + reset on re-register; `scheduled_messages`
  в `DEFAULT_EVENT_TYPES`); `ScheduleSendButton`+`SchedulePopover`
  в actionsRow ComposeBox (4 пресета: завтра 09:00/15:00, понедельник
  09:00/15:00 + datetime-local picker, min=now+1мин); специальный вид
  «Отложенные» (`/scheduled`) добавлен в `BUILTIN_VIEWS` и
  `Feed`-диспетчер; страница `Scheduled` показывает destination +
  delivery time + body preview + cancel; failed messages выделены
  danger-границей. 985 unit-тестов; гейты зелёные. Live-протык на
  стенде ⏳ ждёт владельца.
- ✅ **4.1 Загрузки файлов** — `api/upload.ts` отдельный
  `XMLHttpRequest`-транспорт для `POST /user_uploads` (fetch не
  отдаёт upload-progress); `apiClient.uploadFile`; чистые хелперы
  `sanitiseLinkText`/`isImageType`/`uploadToMarkdown` (escape `[/]`
  → fullwidth, image vs. file разводятся `!` префиксом). UI:
  `useUploadManager` (per-compose state machine с `AbortController`
  на слот, статусы uploading/error/aborted, on-success вставляет
  Markdown в textarea и убирает чип); `UploadButton` (paperclip +
  visually-hidden `<input type=file multiple>`); `UploadChips`
  (filename + progress bar через `--upload-progress` CSS-property,
  cancel/dismiss IconButton); ComposeBox: paperclip в actionsRow,
  paste-handler на textarea, drag-drop на форму. 992 unit-тестa;
  гейты зелёные. Live-протык на стенде ⏳ ждёт владельца.
- ✅ **4.4 User status (текст + эмодзи)** —
  `apiClient.updateOwnUserStatus({ statusText, emojiName,
  emojiCode, reactionType })`; `UserStatus.reaction_type` /
  `UserStatusEvent.reaction_type` расширены до `ReactionType | ""`,
  чтобы wire-сигнал «очистить» был легален в типах.
  `useUserStatusesStore` бакетирует `UserStatus`-ы по user-id,
  гидратируется из `user_status` снапшота register, фолдит
  realtime-события через чистые `hydrateFromSnapshot`/
  `applyUserStatusEvent` (empty-string clear, drop-on-empty).
  UI: `StatusEditor` (popover с 60-char input + emoji-picker
  reuse + Save/Clear/Cancel + char-counter с danger-overflow);
  `StatusButton` в navbar (триггер с инлайн-предпросмотром
  emoji+text); правый сайдбар `UserRow` рендерит status emoji
  рядом с именем + status text под именем. 1001 unit-тест;
  гейты зелёные. Live-протык на стенде ⏳ ждёт владельца.
- ⏳ **4.2** медиа/лайтбокс; **4.7** виджеты; **4.8** превью ссылок

Открытые мелкие доработки (не блокеры, отдельным проходом):
KaTeX-шрифты (1.7), click-to-narrow по меншенам (1.7), pinned-sticky
recipient-бары (1.6), `peer_add/remove` не обновляет `subscribers`-
массивы (1.8 — список участников канала дрейфит до re-register),
`act()`-warning в тестах `MessageFeed` (1.6), lockfile в `.gitignore`.

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
- 0.5: **`package-lock.json` в `.gitignore`** (наследие скаффолда 0.1) —
  lockfile НЕ коммитится, новые зависимости не зафиксированы по версиям.
  Спорное решение, влияет на воспроизводимость; вынести на владельца —
  убрать из `.gitignore` и закоммитить lockfile?
- 0.6: тесты примитивов — **co-located** (`src/components/<Name>/
  <Name>.test.tsx`); `vite.config.ts` `test.include` расширен на
  `src/**` (привёл конфиг в соответствие с GUIDE §3).
- 0.6: найден и пофикшен баг — overlay-примитивы (Tooltip/Popover/
  DropdownMenu) не позиционировались, т.к. `Button`/`IconButton` не были
  `forwardRef`. Все интерактивные примитивы переведены на `forwardRef`.
- 0.6: token-доборка прошла через оркестратора (`scales.containerWidth`,
  роли `success/warning/overlayScrim/avatar1-5`, 3 иконки). Цвета
  success/warning и палитра аватаров одобрены владельцем.
- 0.6: `_overlay/` — внутренний хелпер overlay-семейства (не публичный
  примитив), позиционирование пишет `--overlay-x/-y` императивно через
  ref (JSX `style` запрещён линтом).
- 1.1: **`zustand` не был установлен**, хотя в стеке GUIDE §1 — пропущен
  в Фазе 0. Доустановлен оркестратором (`^5.0.13`), как и
  `react-router-dom`/`react-query` в 0.5.
- 1.1: баг гидрации найден протыком — `onRehydrateStorage` срабатывает
  синхронно внутри `create()`, когда `useAuthStore` ещё в TDZ. Фикс:
  явный `initialize()`-экшен, зовётся из `App` на маунте.
- 1.1: **живой вход на стенд (чеклист 1.1-П / -E) не протыкан** — нужен
  ввод пароля тест-аккаунта руками владельцем (правило безопасности:
  пароли вводит владелец). Email тест-аккаунта: `a.fedotov@friflex.com`.
  Сделать при первой возможности: один вход → проверить редирект на `/`,
  навбар с email, logout, автологин при релоаде.
- 1.1: `e2e/smoke.spec.ts` устарел (ждёт «scaffold OK» на `/`, а теперь
  `/` редиректит на `/login`). Был сломан ещё до 1.1; обновить —
  фактически это и есть чеклист-пункт 1.1-E (Playwright login-flow).
- 1.1: `npm run typecheck` (`tsc --noEmit`) НЕ покрывает тест-файлы —
  их ловит только `tsc -b` в `npm run build`. Гонять оба.
- 1.3: **уточнение к флагу выше** — корневой `tsconfig.json` references-
  only (`files: []`), так что `tsc --noEmit` не проверял НИЧЕГО в `src/`.
  Реальный тайпчек всё это время делал `tsc -b` внутри `npm run build`.
  Скрипт `typecheck` исправлен на `tsc -b` — теперь честный.
- 1.3: domain-гэп — `realm_users` в register-снапшоте без `is_active`
  (API гарантирует «все активные»), а `User` его требует. Стор
  заполняет `true`. Мелочь, но несоответствие типа и payload.
- 1.3: domain-гэп — `PresenceEvent.presence` (legacy-формат) в
  `src/domain` типизирован как `Record<string,Presence>`, а реальный
  legacy-wire — per-client `{client,status,timestamp,pushable}`.
  Редьюсер следует типу (заморожен). Чистый фикс: добавить
  `client_capabilities: simplified_presence_events` в register-вызов,
  чтобы legacy-формат вообще не приходил — не сделано, на решение.
- 1.3: `realmStore` — только гидрация, без event-редьюсера
  (realm-update события в long-tail, не типизированы). Живые изменения
  realm подхватываются только на re-register.
- 1.4: `is:reacted` в Zulip НЕ существует (сверено с исходником). Вид
  «Реакции» = narrow `[{has,"reaction"},{sender,"me"}]` — как в родном
  web-клиенте Zulip. Подтверждено оркестратором.
- 1.4: narrow «Реакции» использует литерал `sender:me` — Zulip резолвит
  его на сервере. Если ленте/API 1.6 нужен конкретный user-id —
  резолвить в API-слое/сторе (не в чистом кодеке).
- 1.5a: эндпоинт топиков — `GET /users/me/{stream_id}/topics` (не
  `/streams/{id}/topics`, как казалось); путь сверен с `zulip.yaml`.
- 1.5a: бейдж вида Starred — осознанно нет (нет понятия «непрочитанное
  отмеченное»). Wildcard-mentions в live-`message`-пути не считаются в
  `mentions`-бакет (снапшот их учитывает при гидрации) — на доработку,
  если понадобится точный live-счётчик.
- 1.6: ~~у `apiClient` нет таймаута запроса~~ — **ЗАКРЫТО** (коммит
  `2813c19ab7`): `sendRequest` теперь с AbortController-таймаутом (30с
  дефолт, `ApiError` code `TIMEOUT`); `getEvents` opt-out на 120с
  (long-poll) через `RequestSpec.timeoutMs`.
- 1.6: в тестах `MessageFeed`/`Feed` — React `act(...)` warning
  (async-апдейт стейта не обёрнут). Тесты проходят; подчистить при
  доработке 1.6-тестов.
- 1.6: стенд `95.84.162.15:8843` из текущего окружения **не отвечает**
  (`register` + `messages` висят) — живой протык всей Фазы 1 нужно
  делать на машине владельца / в его сети.
- 1.6: recipient-бары — in-flow виртуализированные строки, не
  pinned-sticky. Если нужна закреплённость при скролле — отдельная
  доработка (overlay-заголовок).
- 1.7: `.stylelintrc.json` — добавлен `ignorePseudoClasses [global,
  local]` (GUIDE требует `:global()` для стилей серверного HTML).
  Одобрено оркестратором.
- 1.7: **KaTeX-шрифты не подключены** — математика рендерится
  структурно (CSS поверх server-разметки), но для пиксель-точных
  глифов нужен пакет `katex` (только CSS+woff2). Не добавлял —
  решение по зависимости за владельцем/оркестратором. Не блокер.
- 1.7: click-to-narrow по меншенам — не подключён (только стили),
  чистая будущая доработка.
- **Живой протык Фазы 1 на стенде — пройден** (вход
  `a.fedotov@friflex.com`, real data во всех колонках). Найдено и
  пофикшено: unicode emoji рендерились как `:point_right:` текст —
  добавлен `decorateEmojis` (codepoint из class `emoji-1f449` →
  `String.fromCodePoint`), 7 unit-тестов. Известное:
  «В этом канале» в правом сайдбаре показывает «Нет данных» — это
  тот же `peer_add/remove` gap (1.8 флаг); канал-список участников
  ждёт расширения `streamsStore`.
- Если у владельца не вошло: возможно был стейл-кеш браузера или
  старый `localStorage` со сломанной гидрацией (флаг 1.1) — сейчас
  фикснуто, тогда могло вешаться. Достаточно очистить site data и
  логиниться заново.

## Среда / гейты

- Гейты на каждом шаге: `npm run typecheck`, `npm run lint`,
  `npm run test`, `npm run build` — все зелёные.
- Браузер-протык — через Claude-in-Chrome на :5173, по `PRD.md` §7.1
  (включая эстетическую согласованность).
- Dev-сервер запускать в фоне для протыка, гасить после (`pkill -f vite`).
