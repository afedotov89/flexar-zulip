# Flexar Hub

> 📚 **Upstream Zulip README** (про сам движок Zulip — фичи, контрибьюты в апстрим,
> сообщество, лицензия): <https://github.com/zulip/zulip/blob/main/README.md>
>
> Этот файл — README **нашего форка**. Если ищешь информацию про Zulip как
> продукт — смотри ссылку выше. Если про то, как этот форк собран, развёрнут
> и куда мы его ведём — читай дальше.

---

## TL;DR

**Flexar Hub** — корпоративный AI-нативный мессенджер для российского
B2B-рынка. Это **форк [zulip/zulip](https://github.com/zulip/zulip)** с
докрутками под нашу AI-платформу Flexar (отдельный проект; этот хаб — не
Flexar-RAG, а наш «единый точка входа» с агентами и людьми в одних тредах).

Текущее состояние: **production-ready stock Zulip развёрнут**, без
AI-доработок. AI-слой ещё впереди — план в [Roadmap](#roadmap).

- **Образ:** `ghcr.io/<owner>/flexar-zulip-server:<sha>` (ARM64)
- **CI/CD:** push в `main` → GH Actions → ghcr.io → SSH-деплой на хост
- **Дефолтная ветка форка:** `main`. Наша рабочая — `flexar/main` (то же,
  что main: всё мерджим через PR в main).

Детали прод-окружения (адреса хостов, имя организации, контакты админов) —
во **внутренней документации команды**, не в публичном репо.

---

## Почему Zulip (а не Mattermost / Rocket.Chat / Matrix)

Решение принято после серии раундов с LLM-советом (GPT, Gemini, Claude,
DeepSeek, Kimi, Grok, Qwen). 7 из 7 моделей независимо подтвердили выбор
Zulip. Ключевая логика:

| Критерий | Zulip | Почему важно для нас |
|---|---|---|
| **Threading model** | streams + topics — first-class объекты с уникальным URI (`#stream>topic`) | AI-агент подписывается на topic как на pub/sub — чистые границы контекста для RAG. У Slack-like — плоская модель, AI вынужден гадать. |
| **Лицензия** | Apache 2.0 сквозная (server + Flutter mobile + web) | Без AGPL-триггеров, без EE-локов, без community-limits. ФСТЭК/152-ФЗ — путь чистый. |
| **Стек** | Python 3 + Django + PostgreSQL + Tornado | Совпадает с основным Flexar (Python/Quart) → одна экосистема, шарящиеся либы, AI-разработка эффективна. |
| **Mobile** | Flutter rewrite (2024) — нативные виджеты | Custom message types (AI-карточки) рендерятся on mobile «бесплатно». У Mattermost плагины не работают на мобиле вообще. |
| **Enterprise** | LDAP/SAML/OIDC/SCIM/audit/retention — в core | Не за paywall, как у Mattermost EE. |
| **Upstream** | Kandra Labs (Tim Abbott) — активный, релизы 6 нед | Не мертвая база (как Actor Platform). |

**Главный AI-инсайт:** UX-боль Zulip («почему я должен называть каждый topic?»)
становится **киллер-фичей**, если AI делает auto-topicing невидимо. Получаем
positive feedback loop: пользователь пишет как в Telegram → AI создаёт
Zulip-уровень структуры → AI потребляет ту же структуру для лучших ответов.
Никто из конкурентов этот цикл повторить не может — у них нет first-class
topics.

---

## Архитектура deploy

```
                            ┌─────────────────────────────────────┐
   git push main            │  GitHub Actions (ubuntu-24.04-arm)  │
   ────────────────────────►│  • docker buildx (native arm64)     │
                            │  • push ghcr.io/.../...:<sha>       │
                            │  • scp deploy_zulip.sh → host       │
                            │  • ssh deploy@host 'deploy_zulip..' │
                            └────────────────┬────────────────────┘
                                             │
                                             ▼
                     ┌────────────────────────────────────────────┐
                     │  Self-hosted ARM64 Linux box               │
                     │  (host details — internal docs)            │
                     │                                            │
                     │  docker compose (5 containers):            │
                     │  • flexar-zulip-database    (postgres 14)  │
                     │  • flexar-zulip-memcached   (alpine, SASL) │
                     │  • flexar-zulip-rabbitmq    (4.2)          │
                     │  • flexar-zulip-redis       (alpine, auth) │
                     │  • flexar-zulip-server      (our image)    │
                     │                                            │
                     │  Default host ports (overrideable via env):│
                     │  • $ZULIP_HTTP_PORT  → server:80           │
                     │  • $ZULIP_HTTPS_PORT → server:443          │
                     │                                            │
                     │  Persistent named volumes:                 │
                     │  • flexar-zulip_zulip-data                 │
                     │  • flexar-zulip_postgresql-14              │
                     │  • flexar-zulip_rabbitmq                   │
                     │  • flexar-zulip_redis                      │
                     └────────────────────────────────────────────┘
```

**Цель — host-agnostic CI/CD.** Все host-specifics параметризованы через
GitHub Secrets (см. ниже): `VM_HOST`, `VM_USER`, ключ SSH, порты,
external host. Деплой на другой сервер сводится к обновлению секретов.

---

## Структура репозитория

Всё наше живёт в одной папке, чтобы upstream-мерджи были чистыми:

```
flexar/
└── deploy/
    ├── Dockerfile              # двухстадийная сборка из исходников форка
    ├── docker-compose.yml      # 5-сервисный compose stack
    ├── deploy_zulip.sh         # серверный скрипт (pull + recreate)
    ├── entrypoint.sh           # vendored из upstream zulip/docker-zulip
    ├── manage.py               # vendored helper
    ├── upgrade-postgresql      # vendored helper
    ├── custom_zulip_files/     # drop-in для site patches (пока пусто)
    ├── .env.example            # шаблон env для local dev
    ├── .dockerignore           # build-context filter (важно — см. Gotchas)
    └── README.md               # доки по deploy

.github/workflows/
└── flexar-deploy.yml           # GH Actions: build + push + deploy

.dockerignore                   # корневой dockerignore (используется build'ом)
```

Остальное в репе — **апстримный Zulip**, в идеале не трогаем (или
трогаем минимально и осознанно).

---

## Quick start — внести изменение и увидеть его на проде

```bash
# 1. Клонируй:
git clone git@github.com:<owner>/flexar-zulip.git
cd flexar-zulip
git checkout flexar/main

# 2. Поправь что нужно. Например, в flexar/deploy/docker-compose.yml,
#    или в zerver/, web/, static/ — апстримный код Zulip.

# 3. Закоммить и запушь:
git add <files>
git commit -m "feat(...): что сделал"
git push origin flexar/main

# 4. PR в main через GitHub UI, мерджи (squash или merge — без разницы):
gh pr create --base main --head flexar/main --title "..." --body "..."
gh pr merge --merge

# 5. CI запустится автоматически (paths-filter в workflow). Watch:
gh run watch

# ARM64 build обычно ~10-15 мин (с кэшем). Push в ghcr.io ~2 мин.
# Deploy на хост ~5-10 мин (recreate + Zulip cold-start).

# 6. Проверь версию через API (URL хоста — во внутренней документации):
curl -k "https://<host>/api/v1/server_settings" | jq .zulip_version
# должна быть свежая SHA коммита
```

Если push не триггерит workflow — проверь `paths:` в
`.github/workflows/flexar-deploy.yml`. Можно форс через UI: Actions →
"Flexar Zulip — Deploy" → "Run workflow".

---

## Локальная сборка (без CI)

Полная пересборка локально на Apple Silicon (native arm64, без qemu):

```bash
cd <your-clone>/flexar-zulip
cp flexar/deploy/.env.example flexar/deploy/.env
# Поправь .env: сгенери рандомные пароли, EXTERNAL_HOST=localhost:8843
docker compose -f flexar/deploy/docker-compose.yml \
                --env-file flexar/deploy/.env build
# ~30-60 мин первый раз (native), потом из кэша — минуты.

docker compose -f flexar/deploy/docker-compose.yml \
                --env-file flexar/deploy/.env up -d
# Открой https://localhost:8843/, прими self-signed cert.
```

На x86 build будет работать через qemu-эмуляцию — медленно и с риском
Puppet exec timeouts на Go-сборках (smokescreen и т.п.). См. Gotchas.

---

## Server ops

Все host-specific параметры (адрес, пользователь, SSH-ключ, порты) живут
**во внутренней документации команды**, не в репо. В этом разделе —
только generic ops, безотносительно к конкретному хосту.

### Common ops

```bash
# Логи zulip-server (Django stderr — самое полезное):
ssh deploy@<host> \
  'docker exec flexar-zulip-server tail -100 /var/log/zulip/errors.log'

# Полный supervisord state:
docker logs flexar-zulip-server --tail 200

# Запустить Django manage.py (всегда как user zulip!):
docker exec flexar-zulip-server su zulip -c \
  "/home/zulip/deployments/current/manage.py <COMMAND>"

# Создать новый realm creation link:
docker exec flexar-zulip-server su zulip -c \
  "/home/zulip/deployments/current/manage.py generate_realm_creation_link"

# Рестарт стека целиком:
cd ~/zulip && docker compose --env-file ~/zulip.env restart

# Полный wipe (ОСТОРОЖНО — потеряете данные):
cd ~/zulip && docker compose --env-file ~/zulip.env down -v
```

### Что где лежит на хосте (под deploy user)

| Путь | Что |
|---|---|
| `~/zulip/docker-compose.yml` | compose-стек (обновляется при каждом деплое) |
| `~/zulip.env` | env-файл (генерится `deploy_zulip.sh` при каждом деплое) |
| `~/deploy_zulip.sh` | scp-нутый CI скрипт |
| `~/.ssh/authorized_keys` | публичные ключи CI и админов |
| `docker volume inspect ...` | данные Postgres/Redis/Rabbit/Zulip |

---

## Секреты

### Локально (для разработчика)

Backup всех GH Secrets хранится только на локальной машине каждого
разработчика, права 600. Никогда **не коммитим, не шарим в чате, не
передаём в инструменты**. Если вдруг придётся пересоздать GH Secrets —
оттуда восстанавливаем.

### В GH Actions (для CI)

`Settings → Secrets and variables → Actions`. Список:

| Имя | Что |
|---|---|
| `VM_HOST` | адрес деплой-хоста |
| `VM_USER` | системный пользователь для деплоя |
| `VM_SSH_PRIVATE_KEY` | приватный SSH-ключ (публичный в `~deploy/.ssh/authorized_keys`) |
| `ZULIP__POSTGRES_PASSWORD` | random 32B base64 (`openssl rand -base64 32`) |
| `ZULIP__MEMCACHED_PASSWORD` | random 32B base64 |
| `ZULIP__RABBITMQ_PASSWORD` | random 32B base64 |
| `ZULIP__REDIS_PASSWORD` | random 32B base64 |
| `ZULIP__SECRET_KEY` | random 64B base64 (Django SECRET_KEY) |
| `ZULIP_HTTP_PORT` | публичный порт HTTP (например `8800`) |
| `ZULIP_HTTPS_PORT` | публичный порт HTTPS (например `8843`) |
| `ZULIP_EXTERNAL_HOST` | host:port или домен — как Zulip представляется наружу |
| `ZULIP_ADMIN_EMAIL` | email админа realm'а (для уведомлений) |
| `CERTIFICATES` | `self-signed` или `mounted` (если bind'им real cert) |

Опциональные (для SMTP, кастомного auth, тюнинга):
`SETTING_EMAIL_HOST`, `SETTING_EMAIL_HOST_USER`, `ZULIP__EMAIL_PASSWORD`,
`SETTING_EMAIL_PORT`, `SETTING_EMAIL_USE_TLS`, `SETTING_NOREPLY_EMAIL_ADDRESS`,
`ZULIP_AUTH_BACKENDS`, `LOADBALANCER_IPS`, `TRUST_GATEWAY_IP`,
`NGINX_WORKERS`, `AUTO_BACKUP_ENABLED`, `SETTING_FAKE_EMAIL_DOMAIN`.

### Ротация

```bash
NEW=$(openssl rand -base64 32 | tr -d '\n')
echo -n "$NEW" | gh secret set ZULIP__POSTGRES_PASSWORD
# Затем редеплой через push в main или через workflow_dispatch.
# WARN: для postgres_password нужна ещё ручная ALTER ROLE в БД,
# см. https://zulip.readthedocs.io/projects/docker/...
```

---

## Container registry

Используем **GitHub Container Registry** (ghcr.io). Public репо → бесплатно
+ автоматически через `GITHUB_TOKEN`, никаких внешних credentials.

Образ: `ghcr.io/<owner>/flexar-zulip-server:<sha>` и `:latest`.

Build cache: `ghcr.io/<owner>/flexar-zulip-server:buildcache-v2`.

Если когда-нибудь надо будет переезжать на `cr.yandex` (для гос-сегмента):
~10 строк в `flexar-deploy.yml` поменять + добавить `YC_SA_JSON_CREDENTIALS`
и `YC_REGISTRY_ID` в GH Secrets.

---

## Gotchas (грабли, на которые мы наступили — записал чтобы не наступать снова)

Каждая из этих штук стоила одного зелёного коммита. Полезно при debug'е:

1. **`.git` нужен внутри образа.** `tools/provision` и `tools/build-release-tarball`
   читают git-state (`git rev-parse HEAD` / `git archive HEAD`). Мы исключаем
   `.git` из build context чтобы не тянуть 1 ГБ — поэтому **синтезируем
   локальный `.git` внутри Dockerfile** через `git init && git add -A &&
   git commit`. Не трогать без понимания.

2. **`static/generated/` и `web/generated/` — tracked**, не исключать их в
   `.dockerignore`. Они нужны как parent-папки для symlinks, которые
   создаёт `tools/setup/emoji/build_emoji` в provision phase. Иначе
   `os.symlink` падает с ENOENT (не на source, а на parent of dst).

3. **qemu-эмуляция arm64 ломается на Go-сборках** (smokescreen, tusd,
   go-camo). Puppet exec timeout 300s, а Go-build smokescreen под qemu
   занимает 5-10 мин. Используем `runs-on: ubuntu-24.04-arm` (бесплатный
   native ARM64 runner для public репо). Build с 3 ч до ~15 мин.

4. **GH Actions нужен `packages: write`** чтобы пушить в ghcr.io (первый
   push создаёт package). Default — `contents: read` only.

5. **Sidecar hostnames должны быть pinned** (`hostname: memcached`,
   `hostname: redis`, etc). Memcached SASL пишет `zulip@$HOSTNAME:password`;
   без pin'а `$HOSTNAME` — random container ID, и Zulip auth fails
   (`zulip@memcached` ≠ `zulip@<random>`).

6. **`deploy_zulip.sh` всегда extract compose из image**, не «только если
   нет». Иначе изменения в `docker-compose.yml` (например, hostname-pin)
   никогда не доедут до хоста: compose не видит config-diff, sidecars
   не recreate.

7. **Пароли в env передавать как `SECRETS_*`, не `ZULIP__*`.** Entrypoint
   scan-ит `SECRETS_*` переменные и копирует их в
   `/etc/zulip/zulip-secrets.conf`. `ZULIP__*` нейминг — это для Docker
   secrets через `/run/secrets/zulip__*` (отдельный codepath).

8. **`SETTING_FAKE_EMAIL_DOMAIN` обязателен для IP-only deploy.** Zulip
   создаёт synthetic email `bot@<EXTERNAL_HOST>` для cross-realm bots.
   Если EXTERNAL_HOST — IP, это не valid email → home page падает с
   `InvalidFakeEmailDomainError`. Default — `flexar.local`. Когда будет
   нормальный DNS-домен — можно убрать или поменять.

---

## Roadmap

### Сразу следующее (дни)

- [ ] **Брендинг** в "Flexar Hub" (логотип, цвета `#e61d23`, имя
      realm'а). Через realm settings + custom CSS.
- [ ] **Реальный домен + Let's Encrypt** — например, `hub.<our-domain>`.
      Тогда уходит self-signed warning.
- [ ] **SMTP** — для invite-mail. Yandex или другой провайдер.

### AI-фичи (недели — основная ставка проекта)

- [ ] **Auto-topicing AI**: первая киллер-фича.
  - Pre-send hint: AI предлагает topic при наборе сообщения.
  - Background auto-classify: если пользователь не указал topic → AI ставит.
  - UX: видимое уведомление «AI поместил в topic X, изменить?».
- [ ] **Agent-as-channel-member**: AI-агенты подписываются на конкретные
      topic'и через Bot API (`python-zulip-api`). Каждый агент — отдельный
      bot user, шлёт сообщения, реагирует на упоминания.
- [ ] **AI summary как custom message type**: stateful AI-карточки внутри
      треда (live-update по мере появления новых сообщений).
- [ ] **RAG-интеграция** с основным Flexar: чтобы агенты в Zulip могли
      использовать корпоративный knowledge base.

### Долгосрочно (месяцы)

- [ ] **Flutter mobile fork** под Flexar Hub (свой App Store + Google Play +
      RuStore аккаунты, ребрендинг).
- [ ] **ФСТЭК-сертификация** (если зайдём в гос-сегмент).
- [ ] **Yandex OAuth** как auth backend (как в основном Flexar).
- [ ] **Native voice/video** — через интеграцию с Jitsi или Yandex Meet.

---

## Известные ограничения

- **Self-signed TLS** на текущем стенде — браузер ругается при первом
  заходе. Принять warning или перейти на Let's Encrypt (нужен домен).
- **Нет SMTP** — пока invite-ссылки не приходят на email, а пишутся в
  логи Django. Залогинить bash на хост, поискать `generate_realm_creation_link`
  или генерить invite через UI и копировать URL руками.
- **Single-instance deploy** (одна машина) — это dev/staging, не
  production-grade под нагрузку. Для прода с большим числом пользователей
  нужен горизонтально масштабируемый stack.
- **Production push notifications не настроены** — все warn'ы про
  «Mobile push notifications are not configured» можно игнорить, пока не
  нужны mobile-push (требуется регистрация у Zulip Cloud's push bouncer
  service, см. их docs).
- **Mobile-app — стандартный Zulip Flutter app** (не наш). Чтобы свой —
  см. Roadmap.

---

## Upstream sync

Когда захочется подтянуть свежий Zulip:

```bash
git remote add upstream https://github.com/zulip/zulip.git   # один раз
git fetch upstream main
git checkout main
git merge upstream/main         # или rebase, по вкусу
# Резолвить конфликты — должно быть мало, т.к. вся наша работа в flexar/deploy/
# и .github/workflows/flexar-deploy.yml.
git push origin main
```

После апстрим-мерджа стоит **протестить локальную сборку** перед push'ем
в main — апстрим иногда меняет provision-шаги, ломая наш Dockerfile.

Upstream релизы: <https://github.com/zulip/zulip/releases>. Текущую базу
форка узнать через `git log --oneline | head -1`.

---

## Полезные ссылки

| Что | Где |
|---|---|
| Upstream Zulip | <https://github.com/zulip/zulip> |
| Зулип docs | <https://zulip.readthedocs.io/en/latest/> |
| Docker докс | <https://zulip.readthedocs.io/projects/docker/en/latest/> |
| `python-zulip-api` (бот-SDK) | <https://github.com/zulip/python-zulip-api> |
| Flutter mobile | <https://github.com/zulip/zulip-flutter> |
| Helm chart (для k8s, если когда-нибудь) | <https://github.com/zulip/docker-zulip/tree/main/helm> |
| Деплой-доки в нашем форке | [`flexar/deploy/README.md`](flexar/deploy/README.md) |

---

## Лицензия

Apache-2.0 (унаследована от Zulip). Наши изменения тоже Apache-2.0.
