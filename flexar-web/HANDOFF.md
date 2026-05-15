# HANDOFF.md — Flexar Hub Web · состояние оркестрации

> Рабочий файл оркестратора. Обновляется **перед каждым переходом между
> фазами** (и при значимых решениях). Назначение — бесшовное продолжение
> в новой сессии без потери контекста.

**Последнее обновление:** 2026-05-15, после живого протыка Фазы 1 на стенде + emoji-фикс.

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

**Гейт Фазы 1.** Фаза 1 фиче-комплит (1.1–1.8), все unit-гейты зелёные
(632 теста). Осталось закрыть гейт фазы:
1. **Playwright e2e** — `e2e/smoke.spec.ts` устарел (ждёт «scaffold OK»,
   а `/` теперь редиректит на `/login`). Переписать под реальный
   сценарий «логин → narrow → лента видна» (= чеклист 1.1-E). Нужен
   либо мок-бэкенд, либо живой стенд — согласовать.
2. **Живой протык всей Фазы 1** на стенде — критично: всё, что помечено
   «⏳ с владельцем», протыкивается за одну живую сессию (вход
   `a.fedotov@friflex.com` + пароль вводит владелец → события приходят
   → сайдбары/лента/контент с реальными данными → свет/тёмная →
   адаптив). Стенд `95.84.162.15:8843` из dev-окружения оркестратора
   НЕ отвечает — протык на машине/в сети владельца.
3. После гейта — Фаза 2 (путь записи: compose, отправка, реакции,
   редактирование). PRD §8 ФАЗА 2.

Открытые мелкие доработки (не блокеры гейта, можно отдельным проходом):
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
