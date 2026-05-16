# HANDOFF.md — Flexar Hub Web · состояние оркестрации

> Рабочий файл оркестратора. Обновляется **перед каждым переходом между
> фазами** (и при значимых решениях). Назначение — бесшовное продолжение
> в новой сессии без потери контекста.

**Последнее обновление:** 2026-05-17, **compose redesign + sidebars instant-load**:
- **Compose box полностью переделан** (commit `42970d5e05`, +2261/-699):
  inline recipient (channel pill-dropdown + topic input + clear, или DM
  pill-list); preview через toolbar-toggle вместо tabs; formatting
  toolbar с 15+ icon-кнопками (Bold/Italic/Strikethrough/Link/Lists/
  Quote/Spoiler/Code-block/Math/Poll/Todo/Help) + horizontal scroll с
  mask-fade; markdownInsert helpers (16 unit-тестов); SendMenu
  split-button (Send + chevron c 4 schedule-пресетами); DraftsCount
  inline-counter; LimitIndicator (warning/danger threshold); 19 новых
  SVG иконок. Контекстный placeholder textarea
  («Написать в # общее > приветствие»). **Live-протык на стенде ✅**
  (channel popover, send menu, drafts autosave, светлая+тёмная).
- **Sidebars instant-load** (commit `873f553964`): был баг — после
  Cmd+Shift+R sidebars показывали skeletons 5-10 сек (пока realtime
  register не приедет). Архитектурный фикс: добавили `persist` на
  `usersStore` / `streamsStore` / `realmStore` (localStorage cache);
  sidebars показывают skeleton **только когда realtime loading И store
  пустой**. Замер: 1 сек до полностью загруженных sidebars, 0
  скелетонов. Stale-window только до следующего register snapshot.
- **1108 unit-тестов**. Все гейты зелёные.
- Предыдущее (Фаза 5): админка 5.2/5.3/5.4 фиче-комплит + live-протык
  ✅; 5 коммитов закрыли admin entry → 18 apiClient методов →
  пользователи/каналы/invites/организация; нашли и пофиксили 2 бага
  архитектурно (`ce1841b01e`).

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
- **Фаза:** Фазы 0, 1, 2, 3, 4 — фиче-комплит. Фаза 5 — **5.1, 5.2,
  5.3, 5.4, 5.5 сделаны и оттыканы на стенде ✅**. Compose-box
  передизайнен (commit `42970d5e05`) + sidebars instant-load после
  hard reload (commit `873f553964`). Следующая фаза — **Фаза 6
  (полировка)**: 6.9 deploy + 6.4 адаптив + 6.5 тёмная-паритет + 6.1
  клавиатура / либо Playwright гейты Фаз 1-4 (см. «Следующее
  действие»).

### Коммиты на ветке (свежие сверху)
- `873f553964` persist users/streams/realm — sidebars instant-load после hard reload (fix Cmd+Shift+R skeleton-period)
- `42970d5e05` compose — полный редизайн (inline recipient, formatting toolbar, split send menu; 19 иконок; 16 markdownInsert тестов)
- `2c71ae3068` HANDOFF + PRD — Фаза 5 закрыта (live-протык ✅)
- `ce1841b01e` 5.2-fix — default_streams живут в register snapshot (был 405 на GET); icon onError → silent span-фолбэк (был ложный danger Banner)
- `a50847221e` HANDOFF + PRD — Фаза 5 фиче-комплит, мастер-чеклист обновлён
- `b791359aac` 5.4 invites + 5.2 organization settings (8 + 20 unit-тестов; +28)
- `faeafbf00e` 5.4 admin users + 5.3 channel management (11 + 15 unit-тестов; +26)
- `72b24d0b00` 5.x apiClient — 18 admin methods (realm/channels/users/invites; +18 unit)
- `96b9c1a312` 5.x shared infra — admin entry, RequireAdmin, isAdmin, realm/default_streams events
- `1c8317faf5` HANDOFF — план 5.2/5.3/5.4 (minimal-set, не копируем legacy)
- `9c1d2167d3` 2nd i18n RU sweep across the shell, feed, and primitives
- `f323087681` 4.5-fix — scheduled topic display (empty-topic fallback) + /scheduled hydrate-race fix (live-протык)
- `a9c0a25623` 4.7-fix — POST /submessage (singular path; live-протык 404→200)
- `013d7fe263` HANDOFF — 5.5 заметка
- `9370f321d4` 5.5 — subscribe/unsubscribe + browse-channels (`/channels`)
- `c7088b1d81` HANDOFF — 5.1 заметка
- `53baae234d` 5.1 — личные настройки (`/settings` + `useUserSettingsStore` + PATCH /settings)
- `09c768d6c0` HANDOFF — 4.7 заметка
- `74e3e9515e` 4.7 — виджет опросов (poll widget viewer + voting + add-option)
- `97185d326f` HANDOFF — 4.8 заметка
- `835e32513d` 4.8 — стили link-previews (`.message_inline_image`, `.message_embed`)
- `ba488dd9c3` HANDOFF — 4.2 заметка
- `0530e91de9` 4.2 — image lightbox (Lightbox + global store, click-делегация на `<img>`)
- `bcf1470008` HANDOFF — 4.4 заметка
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

**Фаза 5 закрыта. Фазы 0-5 фиче-комплит + протыканы.** На очереди —
Фаза 6 (полировка) и/или Playwright e2e гейты Фаз 1-4.

### Что осталось открытого по PRD §10

#### Фаза 6 — Сквозное и полировка (вся открыта)
- **6.1 Клавиатурная навигация** — горячие клавиши (j/k/c/r/Ctrl+K
  и т.п.). У Zulip это ключевая фича; у нас почти ничего нет.
- **6.2 Доступность (ARIA, фокус)** — формальный аудит aria-labels,
  focus-rings, screen-reader-проверка.
- **6.3 i18n-модуль (ru/en)** — extraction строк в ICU/intl модуль с
  языковым переключателем. Сейчас все строки inline RU без модуля.
- **6.4 Адаптив (брейкпоинты)** — десктоп/планшет/телефон. Сейчас
  sidebars при ≤768px просто `display:none` — это не адаптив.
- **6.5 Тёмная тема — паритет** — формальный аудит, могут быть
  pockets с цветовыми багами.
- **6.6 Производительность** — code-splitting (build предупреждает
  про 550kb бандл), мемоизация, бюджет.
- **6.7 Состояния loading/empty/error везде** — аудит каждой фичи.
- **6.8 Офлайн/реконнект** — поведение UI при разрыве сети + queue
  expiry.
- **6.9 Деплой на стенд** — прод-билд, хостинг (отдельный или рядом
  с Zulip). Без него app живёт только локально на :5173.

#### Гейты Фаз 1-4 (Playwright e2e)
Все 4 фазы фиче-комплит + live-протыканы, но e2e-наборов нет:
- Гейт Фазы 1: «логин → narrow → лента видна»
- Гейт Фазы 2: «отправить сообщение, увидеть в ленте»
- Гейт Фазы 3: реакции/действия/поиск/уведомления
- Гейт Фазы 4: загрузки/lightbox/typing/scheduled/widgets

`e2e/smoke.spec.ts` устарел (ждёт «scaffold OK» на `/`, а теперь
там redirect на /login).

#### Финальная приёмка
- README + список «реализовано vs отложено»
- Полный сквозной протык
- Деплой работает

### Известные мелкие follow-up'ы (флагнуты в коде, не блокеры)

- Compose: maximize/expand/collapse + drag-resize (заглушка); video/
  voice call (нет API); GIF (нет API); saved snippets (нет API);
  global-time picker (нужен widget); quote-and-reply (отдельная
  фича); closed-compose state с 3 кнопками (full reorg);
  scroll-to-bottom button; custom datetime-picker в send-menu
  (только 4 пресета сейчас).
- Admin: icon/logo upload (нет API метода `uploadRealmIcon`);
  group-permissions конструктор с `direct_members + direct_subgroups`
  (упрощено до role dropdowns); bot creation (read-only сейчас);
  crossrealm-bots типа Welcome Bot не показываются в Боты-табе (не
  в `realm_users`); sub-навигация между `/admin/*` роутами (только
  URL bar / navbar dropdown).
- Misc: KaTeX шрифты не подключены (математика рендерится без
  точных глифов); click-to-narrow по @меншенам не подключён;
  pinned-sticky recipient-бары при скролле; `:test_tube:` в
  описании канала рендерится литералом (channel descriptions не
  идут через emoji-decorator); todo-виджеты (отдельный
  widget-protocol); видео-инлайн в lightbox (server `<video>` без
  controls); `act()` warning в `MessageFeed` тестах;
  `package-lock.json` в `.gitignore` (спорное решение со скаффолда);
  `realm`-events приходят только для ключей в `REALM_KEYS` (новые
  поля silently дропаются — extend если понадобится).

### Рекомендуемый приоритет следующего шага

1. **6.9 Деплой на стенд** — без него Hub живёт только в dev. Это
   превращает прототип в реальный workspace.
2. **6.4 Адаптив + 6.5 Тёмная тема паритет** — UX-полировка ровная.
3. **6.1 Клавиатурная навигация** — у Zulip ключевая фича.
4. **Playwright гейты Фаз 1-4** — защита от регрессий.
5. **6.6 Производительность** — code-splitting (admin-страницы → lazy).
6. **6.3 i18n-модуль** — нужно если en-локаль; inline RU работает.

---

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
- ✅ **4.2 Image lightbox** — `useLightboxStore` (single Zustand
  slot: `{open, src, alt}` + `openImage`/`close`); `Lightbox` mounted
  один раз в AppShell, рендерит full-bleed overlay с close-button;
  Esc на document-level + click backdrop → close; focus moves to
  close button on open. `MessageContent`'s click delegation
  расширена: `target instanceof HTMLImageElement && !classList.has("emoji")`
  → `openLightbox(target.src, target.alt)`. Inline-emoji `<img>`
  (с классом `emoji`) исключены, чтобы клик по эмодзи не открывал
  гигантский overlay. 1005 unit-тестов; гейты зелёные.
- ✅ **4.8 Link previews** — серверный rendered_content уже выдаёт
  `<div class="message_inline_image">` (image-URL превью, `<a>`
  обёрнутый вокруг `<img>`) и `<div class="message_embed">` (OG-карточки
  с `.message_embed_image[style="background-image: url(...)"]` +
  `.data-container` с `.message_embed_title` и `.message_embed_description`);
  оба прошли через DOMPurify ранее. Этот коммит дал им CSS:
  inline-image bound 18rem высоты + cursor zoom-in (lightbox affordance);
  embed-card layout thumbnail-left/text-right с clamping description в 3
  строки. Click-делегация в MessageContent переупорядочена: image-check
  ДО anchor-check, иначе клик по image-preview-обёрнутому-в-`<a>` всегда
  навигировал бы вместо открытия lightbox. 1005 unit-тестов;
  гейты зелёные.
- ✅ **4.7 Виджеты (poll)** — `apiClient.sendSubmessage` + `SubmessageEvent`
  + `submessage` в `DEFAULT_EVENT_TYPES` + чистый `applySubmessageEvent`
  редьюсер (idempotent на submessage_id, no-op на uncached parent);
  `messagesStore` фолдит submessage-события, добавляя в
  `Message.submessages`. Чистая `pollState.ts`: `detectPoll` парсит
  initial widget-submessage; `derivePollState` фолдит
  `new_option`/`vote`/`question` с Zulip-encoding ключей
  (`<sender_id>,<idx>` + literal `canned`); dedup-by-text;
  `buildVoteContent`/`buildNewOptionContent` JSON-builders.
  `PollWidget` показывает question + options с tally и voter names,
  кнопкой toggle-vote и inline add-option-form; optimism через
  realtime-echo сервера. `MessageRow`: `detectPoll` → `PollWidget`
  вместо `MessageContent`. Создание поллов остаётся через
  `/poll Question\\nA\\nB` в compose (server detection — без UI).
  Todo-виджеты НЕ реализованы (отдельный widget-protocol —
  `new_task`/`strike`/`new_task_list_title`); добавляются позже без
  изменения этой поверхности. 1018 unit-тестов; гейты зелёные.
  Live-протык на стенде ⏳ ждёт владельца.

**🎯 Фаза 4 фиче-комплит** — 4.1+4.2+4.3+4.4+4.5+4.6+4.7+4.8 закрыты.

### Фаза 5 — частично:
- ✅ **5.1 Личные настройки** — `apiClient.updateOwnSettings(...)`
  для PATCH /settings (Phase-5.1 подмножество: full_name +
  twenty_four_hour_time + enable_sounds + enable_desktop_notifications
  + receives_typing_notifications + starred_message_counts);
  domain `UserSettingsUpdateEvent` + `user_settings` в
  `DEFAULT_EVENT_TYPES`; `useUserSettingsStore` (Record<string,
  unknown> с `getBoolean`/`getNumber`/`getString` селекторами,
  hydrate из снапшота, fold realtime user_settings update events);
  страница `/settings` (Профиль / Предпочтения / Уведомления;
  toggle-row autosave, display-name explicit save); кнопка
  «Настройки» в navbar. Account-level (пароль/ключ/аватар) намеренно
  out-of-scope. 1019 unit-тестов; гейты зелёные. Live ⏳.
- ✅ **5.5 Подписки** — `apiClient.subscribe({subscriptions:
  [{name, description?}], principals?, …})` для POST + `unsubscribe(
  {subscriptions: [name], principals?})` для DELETE
  `/users/me/subscriptions`. `/channels` browse-page: subscribed
  first → alphabetical, search-фильтр, per-row Subscribe/Unsubscribe
  с loading-state; realtime `subscription add | remove` события
  фолдят в `streamsStore` без явной optimistic-обвязки. Sidebar's
  «+» в `ChannelsSection` теперь навигирует на `/channels` (был
  no-op). Out of scope: per-channel settings (5.3), admin remove
  others (5.4). Гейты зелёные.
- ✅ **5.2 Настройки организации** (commit `b791359aac`) — 5 секций
  (Профиль / Сообщения / Доступ / Каналы по умолчанию), autosave per-
  toggle, explicit save для текстовых полей. `apiClient.updateRealm`,
  `getDefaultStreams/add/remove`. Расширены `Realm` тип + `realmReducer`
  (`applyRealmEvent` для `op:"update"` / `update_dict`); `realmStore`
  фолдит `realm`-event (был no-op). Новый `defaultStreamsStore` с
  lazy-fetch и фолдом `default_streams`. 20 unit-тестов. Out of scope:
  icon/logo upload (нет API метода), group-permissions конструктор
  (упрощено до простых toggles/selects).
- ✅ **5.3 Управление каналами** (commit `faeafbf00e`) — `/channels`
  расширен кнопкой «Создать канал» (`CreateChannelModal` с
  name/description/privacy); name каждого канала — Link на
  `/channels/:id`. Новая страница `ChannelDetail` с rename,
  description, admin-only «Доступ» (private toggle, history toggle,
  retention select), «Подписчики» (count, add via
  `AddSubscriberInput`, list с per-row remove via
  `RemoveSubscriberConfirmModal`; non-admin видит только Subscribe/
  Unsubscribe для себя), admin-only «Опасная зона» с
  `ArchiveChannelModal`. 15 unit-тестов.
- ✅ **5.4 Управление пользователями** (commit `faeafbf00e`) —
  `/admin/users`: один список с табами Активные / Деактивированные /
  Боты, search + role dropdown, per-row Edit / Deactivate /
  Reactivate. `EditUserModal`, `DeactivateUserModal`,
  `ReactivateConfirmModal` — все с optimistic + restore-on-fail
  через `setState` к `usersStore`. Self-actions скрыты. Боты read-
  only. 11 unit-тестов.
- ✅ **5.4 Приглашения** (commit `b791359aac`) — `/admin/invites`:
  список pending invites с табами Все / По email / Ссылки. Per-row
  Resend (email-only) / Скопировать ссылку (link-only) / Revoke.
  `SendInviteModal` (emails Textarea + role + expiry + ChannelPicker
  Checkbox-список), `CreateReusableInviteLinkModal` (та же форма
  минус emails; success-view с копируемым URL),
  `RevokeInviteConfirmModal` с optimistic removal. Refetch после
  каждой мутации (нет realtime event для invites). 8 unit-тестов.

**🎯 Фаза 5 фиче-комплит** — 5.1+5.2+5.3+5.4+5.5 закрыты. **1096 unit-
тестов; гейты зелёные.** Live-протык всей админки на стенде — ⏳ ждёт
владельца (паролем).

#### План 5.2/5.3/5.4 (согласован 2026-05-15)

**Принцип:** не копировать legacy Zulip — у них в админке 60+ полей в трёх
секциях (профиль / settings / permissions), много legacy (advertise in
communities directory, custom welcome bot text, demo-org warnings,
two-tier billing, light/dark logos). Делаем minimal современный набор
по мотивам Slack/Linear/Notion. Smотрим Zulip как карту фич, не образец.

**5.2 Настройки организации (`/admin/organization`)** — minimal-set:
- Профиль: name, description, icon (без org-type marketing, без separate
  light/dark logos)
- Сообщения: allow editing + edit time limit, delete time limit, message
  retention (days), edit history visibility
- Каналы: who can create public/private channels (role-based dropdown:
  any / admin / moderator), default streams (add/remove)
- Пользователи: invite required (boolean), waiting period для новичков,
  кто может приглашать (role-based)
- **Save-pattern:** autosave per-toggle (как 5.1); explicit save для
  text-полей с blur. Никаких save/discard widget'ов как у Zulip.
- **Что НЕ делаем:** group-permissions конструктор (direct_members +
  direct_subgroups — слишком сложно), auth methods, linkifiers,
  playgrounds, custom profile fields, exports, deactivate organization.

**5.3 Управление каналами** — расширение `/channels` + `/channels/:id`:
- На `/channels`: добавить кнопку «Создать канал» → Modal (name +
  description + privacy public/private + начальные подписчики).
- Per-channel detail page `/channels/:id`: rename, description, privacy
  toggle (public/private), archive (danger button), retention override,
  список подписчиков с add/remove (admin — любых, обычный юзер — только
  себя), кто может постить (role dropdown), кто может управлять (role
  dropdown).
- **Что НЕ делаем:** channel-folders management, per-channel notification
  settings (это в личных настройках 5.1).

**5.4 Управление пользователями (`/admin/users` + `/admin/invites`)**:
- `/admin/users`: ОДИН список с табами-фильтрами (Активные /
  Деактивированные / Боты — НЕ 4 списка как у Zulip), text-search,
  dropdown по роли. Per-row actions: change role (dropdown),
  deactivate/reactivate (icon-button с confirm-modal), Edit (modal с
  full_name).
- `/admin/invites`: список pending invites + Send invite modal (email +
  role + expiration + начальные каналы) + revoke + resend + create
  reusable link.
- Bots: read-only список в `/admin/users` (создание/удаление ботов —
  отдельный кусок, не в этой итерации).
- **Что НЕ делаем:** imported users sub-tab (legacy migration tool).

**Entry point — современный UX (avatar dropdown):**
- Кнопки «Настройки» и «Выйти» из navbar **переезжают** в DropdownMenu,
  привязанный к email/avatar в navbar.
- Пункты dropdown: Профиль / Настройки → `/settings` ─── (если admin)
  ─── Администрирование → `/admin/users` (по дефолту) / Выйти.
- Освобождает navbar, читается как Slack/Linear/Notion-pattern.

**Роуты (плоско, без AdminLayout — решение владельца):**
- `/admin/organization` (5.2)
- `/admin/users` (5.4 список)
- `/admin/invites` (5.4 invites)
- `/channels/:id` (5.3 detail)
- `/channels` уже есть (расширить)
- Гард: `RequireAdmin` HOC поверх `RequireAuth` для всех `/admin/*`.

**API/events добавки (~15 новых apiClient методов):**
- Realm: `updateRealm`, `uploadRealmIcon`
- Channels: `createChannel`, `getStreamById`, `updateChannel`,
  `archiveChannel`, `getChannelSubscribers`
- Default streams: `addDefaultStream`, `removeDefaultStream`
- Users: `updateUser`, `deactivateUser`, `reactivateUser`
- Invites: `getInvites`, `sendInvites`, `createReusableInviteLink`,
  `revokeInvite`, `resendInvite`

**DEFAULT_EVENT_TYPES добавки:** `realm`, `default_streams`.

**Domain types добавки:** `Invite` (api/types.ts), `RealmUpdateEvent` и
`DefaultStreamsEvent` (events.ts).

**Порядок реализации (параллельно после shared infra):**
1. Группа A (sequential): shared infra — `isAdmin` selector, navbar
   dropdown, `RequireAdmin` guard, `realm` event добавлен в
   `DEFAULT_EVENT_TYPES`, `RealmUpdateEvent` type, новые apiClient методы
   (закрытый контракт).
2. Группы B/C/D параллельно после A: 5.4 / 5.3 / 5.2.
3. Live-протык на стенде (см. memory `live-protyk-mandatory.md` —
   обязателен после каждой фичи).
4. Гейты + commit + HANDOFF update.

### Live-протык на стенде (`a.fedotov@friflex.com`) — сессия 2026-05-15
Прошёл сквозной протык **7 фич** на стенде, найдено и пофикшено
**3 бага**:

- ✅ **5.5 channels** — subscribe DELETE 200 → `#песочница`
  выпала из sidebar; subscribe POST 200 → вернулась с топиками.
  Фильтр работает; sort subscribed-first сохраняется.
- ✅ **5.1 settings** — PATCH /settings 200 на toggle of 24-h time;
  realtime user_settings event обновил store; toggle переключился
  визуально. Заметка: при автоматизации лучше кликать по label,
  не по hidden-input через ref.
- ✅ **4.4 user status** — POST /users/me/status 200 → navbar chip
  «Тестирую Flexar Hub», правый сайдбар UserRow получил status
  text под именем; clear → восстановлено.
- ✅ **4.5 schedule popover + /scheduled list + cancel** — POST
  /scheduled_messages 200 на «Завтра 09:00» preset, body cleared,
  popover закрылся; `/scheduled` показал record с правильным
  delivery time; DELETE → realtime remove → empty state.
- ✅ **4.7 poll widget** — `/poll Coffee or tea?` создал виджет;
  клик на «Coffee» — vote-tally 1, voter name «Александр Федотов»,
  option highlighted; click again → unvote (tally 0).
- ✅ **4.1/4.2 wiring** — paperclip+hidden multi-file input
  смонтированы; lightbox открывается через store.openImage и
  Esc закрывает.

**Найденные баги:**
1. `apiClient.sendSubmessage` слал `POST /submessages` (plural)
   → 404. Сервер регистрирует `rest_path("submessage")` (singular).
   Фикс `a9c0a25623`.
2. Scheduled-page показывала `# песочница` без topic для
   сообщений в `general chat`. Корень: `realm_empty_topic_display_name`
   на стенде = `general chat`, поэтому сервер интерпретирует
   `topic=general chat` как пустой topic. Фикс: при `topic=""`
   показывать `realm.realm_empty_topic_display_name` или
   `(no topic)` fallback. Коммит `f323087681`.
3. `/scheduled` рендерила empty state даже когда сервер хранил
   3 сообщения. Race: `wireStore.hydrate` сбрасывает store на
   каждом register, `useEffect` с stable-action-ref не
   пере-фетчил. Фикс: добавить `loadStatus` в dep array.
   Коммит `f323087681`.

**Open follow-up:** добавить `realm` в `DEFAULT_EVENT_TYPES`,
чтобы realm-store получал `realm_empty_topic_display_name` (сейчас
fallback `(no topic)`).

---

### Bug-sweep архитектурные фиксы (2026-05-15, commit `96dddabb44`)

| # | Bug | Архитектурный фикс | LIVE ✅ |
|---|---|---|---|
| 1 | optimistic-echo показывал raw markdown | `register({applyMarkdown: true})` + дефолт в `apiClient.getMessages` | ✅ markdown теперь рендерится сразу без reload |
| 5 | EN error messages | `src/lib/errors/describeApiError` — substring-match таблица RU + verbatim-fallback; убран дублированный `describeError` в 12 местах | ✅ |
| 13 | popover клиппится navbar'ом | `useOverlayPosition` flip-on-no-fit + final `clampToViewport` | ✅ reaction picker на верхнем сообщении открывается вниз |
| 14 | lightbox scrim слишком прозрачный | новая color role `overlayScrimStrong` (80%/88%); modal scrim не тронут | ✅ заметно темнее |
| 16 | peer_add не обновлял `subscribers[]` | `register({includeSubscribers: true})` + `adjustSubscriberList` reducer | ✅ «В этом канале» показывает 3 участников |
| 6-12 | i18n EN/RU mix | sweep по всем user-facing файлам (actions menu, edit form, history modal, drafts page, channels, settings, emoji picker, lightbox, schedule, upload chips, status editor, compose) | ✅ |

Bug #15 (skeleton timing) исчез сам по себе после fix #16 — меньше re-fetches.

Bug #17 (typeahead `:emoji:` в начале textarea) — оказался false positive: тест был контаминирован остатками draft-контента.

Bug #19 (KaTeX single-dollar) — серверная Zulip-фича, скип; при необходимости можно добавить hint в compose.

### Сплошной live-протык — каталог багов (2026-05-15, после 1-й сессии)

Прошёл по всем реализованным фичам в браузере с реальной сессией.
Гейт-зелёные фичи, не покрытые ранее протыком, верифицированы как
LIVE ✅. Найдено **15+ визуальных огрехов и реальных багов** —
ниже полный каталог, отсортированный по приоритету.

#### High — реальные баги, влияющие на восприятие
1. **🐛 Optimistic-echo overwrites server HTML** (1.7). Сразу после
   `apiClient.sendMessage` сообщение в ленте показывает RAW
   markdown (бэктики, **звёздочки**, `:fire:` в литерале). Только
   после реального reload отображается серверный HTML. Корень:
   `reconcileOptimisticMessage` ставит optimistic-record поверх
   уже принятого realtime-message.
2. **🐛 POST /submessages → 404** (4.7). Уже пофикшено на сессии
   `a9c0a25623`. Запомнить для регрессий.
3. **🐛 Scheduled message empty-topic display** (4.5). Уже
   пофикшено `f323087681` (realm display name fallback).
4. **🐛 /scheduled hydrate race** (4.5). Уже пофикшено `f323087681`
   (loadStatus в dep array).
5. **🐛 Edit-failure error message в EN** ("The time limit for
   editing this message has passed"). Сервер возвращает по-английски,
   но клиент должен либо переводить, либо передавать как есть с
   пометкой о происхождении.

#### Medium — i18n inconsistency (UI смешан EN/RU)
6. **🐛 Drafts page heading "Drafts" в EN**, sidebar "Черновики" RU.
7. **🐛 Message actions menu все в EN**: Star message / Copy link
   to message / Mark as unread from here / Edit message / Delete
   message / View edit history.
8. **🐛 Edit form кнопки EN**: "Edit message", "Cancel", "Save".
9. **🐛 Emoji picker placeholder "Find emoji"** EN.
10. **🐛 Edit history modal все EN**: "Edit history", "edited
    content", "Previous content", "Original message".
11. **🐛 Lightbox aria-label "Image preview"** EN.
12. **🐛 Channel browse "Search channels"** label EN.

#### Medium — visual / UX полировка
13. **🐛 Reaction picker positioned over navbar** (3.2). Когда
    сообщение близко к верху viewport, popover открывается вверх и
    обрезается navbar'ом. `useOverlayPosition` должен флипать вниз
    при недостатке места сверху.
14. **🐛 Lightbox backdrop scrim слишком прозрачный** (4.2).
    Через scrim хорошо виден чат — теряется фокус на изображении.
    Нужно увеличить альфу `--color-overlay-scrim`.
15. **🐛 Sidebars stuck в skeleton ~5 секунд после navigation**.
    Register не успевает завершиться сразу после route-change;
    skeleton-loading держится дольше ожидаемого. Возможно RealtimeConnection
    не reconnect'ит сразу или skeleton-condition слишком грубый.
16. **🐛 Right sidebar "В этом канале — Нет данных"** (1.8). Уже
    зарегистрировано в HANDOFF: `peer_add/remove` gap. Список
    подписчиков канала не обновляется до re-register.
17. **🐛 Typeahead `:emoji:` не триггерит в начале textarea**
    (2.3). Работает после whitespace; `:fi` в начале — нет
    suggestions. `triggerDetect` требует boundary-condition
    (start-of-textarea = boundary).
18. **🐛 Reaction picker иногда выбирает не тот emoji**.
    Кликнул на 🎉, добавилась 💥. Возможно координатная неточность
    клика, но если popover рендерится с задержкой — emoji
    может сдвинуться между screenshot+click.

#### Low — мелочи
19. **🐛 KaTeX `$E=mc^2$` (single dollar) не рендерит**. Это
    Zulip-серверная ограничение — нужно `$$...$$`. Полу-фикс:
    показать пользователю в hint compose-box, что нужно `$$`.

#### Verified LIVE ✅
| Фаза | Что протыкал | Результат |
|------|---|---|
| 1.7 | code/bold/emoji/spoiler/inline-narrow-link | ✅ render after reload (с багом #1 на оптимистике) |
| 2.3 | @ # : typeahead | ✅ @ всегда работает, # после префикса, : требует whitespace перед |
| 2.4 | Drafts autosave + /drafts page + restoration | ✅ |
| 3.1 | Search bar `is:starred` | ✅ 7 starred messages |
| 3.2 | Reactions chip toggle + picker | ✅ |
| 3.3 | Actions menu + Star/Copy/Edit/Delete + flags | ✅ POST /messages/flags 200 |
| 3.4 | Mark-as-read auto + button gating | ✅ button hidden when 0 unread |
| 3.5 | Notification API mounted, permission granted | ✅ |
| 3.6 | Compose emoji picker + search filter | ✅ |
| 4.1 | Paperclip click → file dialog + multi-input | ✅ wiring verified, POST /user_uploads 200 |
| 4.2 | Lightbox open/close + ESC | ✅ |
| 4.3 | Typing indicator POST /typing 200 (debounced) | ✅ |
| 4.4 | User status set + clear via popover | ✅ |
| 4.5 | Schedule popover preset + /scheduled list + cancel | ✅ |
| 4.6 | Edit history modal + collapsible diff | ✅ |
| 4.7 | Poll widget render + vote toggle + voter name | ✅ |
| 4.8 | Inline image preview + OG embed card CSS | ✅ injected fixture rendered |
| 5.1 | Settings page toggles + name save | ✅ PATCH /settings 200 |
| 5.5 | Channels browse + subscribe/unsubscribe | ✅ DELETE/POST 200 |

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
