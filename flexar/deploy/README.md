# Flexar Zulip — deploy

This directory contains everything needed to build the Flexar Zulip Docker
image from this fork and deploy it via GitHub Actions.

For project overview, why-Zulip, gotchas, and roadmap — see the
[root README](../../README.md).

## Files

| File | Purpose |
|---|---|
| `Dockerfile` | Two-stage build; produces ARM64 image from forked source via `COPY` |
| `docker-compose.yml` | 5-service stack: postgres, memcached, rabbitmq, redis, zulip |
| `entrypoint.sh` | Zulip startup script (vendored from upstream `docker-zulip`) |
| `manage.py` | Helper for `docker exec ... manage.py` (vendored) |
| `upgrade-postgresql` | PG major-version upgrade helper (vendored) |
| `deploy_zulip.sh` | Runs on the host; pulls image + recreates compose stack |
| `.env.example` | Template for local + server env files |
| `.dockerignore` | Excludes from build context (real one lives at repo root) |
| `custom_zulip_files/` | Drop-in for site-customizations |

CI workflow lives at `.github/workflows/flexar-deploy.yml`.

## Architecture

```
GitHub push  →  GH Actions runner (ubuntu-24.04-arm, native arm64)
                    │
                    ├─ docker buildx build → linux/arm64 image
                    ├─ docker push ghcr.io/$OWNER/flexar-zulip-server:$SHA
                    │
                    ├─ scp deploy_zulip.sh → $VM_USER@$VM_HOST
                    └─ ssh $VM_USER@$VM_HOST 'deploy_zulip.sh <image_ref>'
                                                        │
                                            ┌───────────┴───────────┐
                                            │ docker compose up -d  │
                                            └───────────┬───────────┘
                                                        │
                              ┌─────────────────────────┼─────────────────────────┐
                              ▼                         ▼                         ▼
                       database (PG14)            redis / memcached / rabbitmq
                                                                                  
                                                  zulip server:80,443 ────► host $ZULIP_HTTP_PORT, $ZULIP_HTTPS_PORT
```

All host-specific values (`$VM_HOST`, `$VM_USER`, port numbers, etc.)
come from **GitHub Secrets**. The deploy is host-agnostic — pointing it
at a different VM is just a secret swap.

## First-time setup

### 1. Container Registry — using ghcr.io (free for public repos)

The deploy uses **GitHub Container Registry** (`ghcr.io`). For a public
repository, this needs **zero setup**:
- GH Actions auto-authenticates via `GITHUB_TOKEN`
- The host pulls public images without credentials

The image will be published as
`ghcr.io/<owner>/flexar-zulip-server:<SHA>` and `:latest`.

If you ever need to switch to Yandex Container Registry (e.g. for
sovereign-cloud requirements), ~10 lines in the workflow change + add
`YC_SA_JSON_CREDENTIALS` and `YC_REGISTRY_ID` secrets.

### 2. SSH key for the deploy user on the VM

Generate (or reuse) a dedicated SSH key pair and add the public half to
`~/.ssh/authorized_keys` of the deploy user on the host:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/flexar_zulip_deploy -N "" \
    -C "github-actions@flexar-zulip"
# Then on the host, append flexar_zulip_deploy.pub to:
#   ~deploy/.ssh/authorized_keys
```

Private half goes into `VM_SSH_PRIVATE_KEY` secret (next section).

### 3. GitHub repository secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**
and add ALL of the following:

#### VM access

| Secret | Example value |
|---|---|
| `VM_HOST` | hostname or IP of the deploy target |
| `VM_USER` | system user with docker access (typically `deploy`) |
| `VM_SSH_PRIVATE_KEY` | full content of the private SSH key |

#### Zulip core secrets — generate with `openssl rand -base64 32`

| Secret | How to generate |
|---|---|
| `ZULIP__POSTGRES_PASSWORD` | `openssl rand -base64 32` |
| `ZULIP__MEMCACHED_PASSWORD` | `openssl rand -base64 32` |
| `ZULIP__RABBITMQ_PASSWORD` | `openssl rand -base64 32` |
| `ZULIP__REDIS_PASSWORD` | `openssl rand -base64 32` |
| `ZULIP__SECRET_KEY` | `openssl rand -base64 64` |

#### Zulip public config

| Secret | Example value |
|---|---|
| `ZULIP_EXTERNAL_HOST` | `chat.yourdomain.example` or `<host>:<port>` |
| `ZULIP_ADMIN_EMAIL` | `admin@yourdomain.example` |
| `ZULIP_HTTP_PORT` | `8800` (or any free high port on the host) |
| `ZULIP_HTTPS_PORT` | `8843` (or any free high port on the host) |
| `SETTING_FAKE_EMAIL_DOMAIN` | `flexar.local` (only needed if EXTERNAL_HOST is an IP) |

#### Optional (outgoing email — required for inviting users)

| Secret | Example value |
|---|---|
| `ZULIP__EMAIL_PASSWORD` | SMTP password |
| `SETTING_EMAIL_HOST` | `smtp.yandex.ru` |
| `SETTING_EMAIL_HOST_USER` | `noreply@yourdomain.example` |
| `SETTING_EMAIL_PORT` | `587` |
| `SETTING_EMAIL_USE_TLS` | `True` |
| `SETTING_NOREPLY_EMAIL_ADDRESS` | `noreply@yourdomain.example` |

#### Optional (advanced)

| Secret | Example value |
|---|---|
| `ZULIP_AUTH_BACKENDS` | `EmailAuthBackend` (default), or comma-separated list |
| `CERTIFICATES` | `self-signed` (default), or `mounted` if you wire real certs |
| `LOADBALANCER_IPS` | If Zulip sits behind another reverse-proxy — its IP |
| `TRUST_GATEWAY_IP` | `true` if behind a trusted reverse-proxy |
| `NGINX_WORKERS` | `2` (sensible default for small ARM hosts) |
| `AUTO_BACKUP_ENABLED` | `false` (we manage backups separately) |

### 4. First run

```
GitHub UI → Actions → "Flexar Zulip — Deploy" → "Run workflow"
```

On a **native ARM64 runner** (`ubuntu-24.04-arm`, free for public repos),
the first build takes **~10-20 minutes** because:

- ARM64 layers are built fresh on first run
- Zulip's `tools/provision` installs hundreds of OS, Python, and Node deps
- Static asset compilation (webpack)

Subsequent builds reuse the registry build cache and finish in
**5-10 minutes**.

The first deploy on the host also includes:

- `postgres` initdb + first migrations (~2 min)
- nginx + supervisord cold start (~30 sec)
- Initial static-asset collection (~1 min)

Plan for **~5-10 minutes from "image pulled" to "Zulip responsive"** on first
boot. Subsequent restarts are fast.

### 5. After first deploy succeeds

Create the first organization (realm) via Django management command on
the host:

```bash
ssh $VM_USER@$VM_HOST
docker exec flexar-zulip-server su zulip -c \
    "/home/zulip/deployments/current/manage.py generate_realm_creation_link"
```

Open the printed URL in your browser, accept the self-signed cert,
register the admin user — done.

### 6. Subsequent deploys

Just push to `main` (touching any file matched by the workflow's `paths`
filter). GH Actions:

1. Rebuilds the image (cache hits → fast)
2. Pushes to ghcr.io
3. SSHes to the host, runs `deploy_zulip.sh`
4. Host pulls and recreates the `zulip` container

The compose stack uses `unless-stopped` restart policy; sidecars (db,
redis, etc.) persist their data via named volumes.

## Local development

To build and run the stack on your laptop (Apple Silicon, Linux/arm64):

```bash
cd <your-clone>/flexar-zulip

# 1. Make a local .env from the template:
cp flexar/deploy/.env.example flexar/deploy/.env
# Edit flexar/deploy/.env: generate real secrets via openssl, set
# ZULIP_EXTERNAL_HOST=localhost:8843.

# 2. Build (~30-60 min on M-series; native arm64, no emulation):
docker compose -f flexar/deploy/docker-compose.yml \
                --env-file flexar/deploy/.env build

# 3. Start the stack:
docker compose -f flexar/deploy/docker-compose.yml \
                --env-file flexar/deploy/.env up -d

# 4. Watch logs:
docker compose -f flexar/deploy/docker-compose.yml logs -f zulip

# 5. Open https://localhost:8843/
```

## Troubleshooting

**Q: Build takes too long on GH Actions.**
A: First build is slow if no cache hits; ghcr buildcache is reused on
   subsequent runs.

**Q: `Permission denied` on volumes / `/data` not writable.**
A: Volumes are managed by Docker — Zulip runs as user `zulip` (uid 1000)
   inside the container. If you bind-mount from the host, ensure host
   directory owner uid is 1000.

**Q: Self-signed cert warning.**
A: Expected. For production, set `CERTIFICATES=mounted` and bind-mount
   a real Let's Encrypt cert at `/etc/letsencrypt`.

**Q: Container is restart-looping.**
A: `docker logs flexar-zulip-server --tail 200`. Common causes:
   - Missing/incorrect secret in `.env` — check error message
   - `EXTERNAL_HOST` mismatch with how you're reaching it
   - DB not ready yet — entrypoint retries, but if it persists,
     `docker compose down && docker volume rm flexar-zulip_postgresql-14`
     and re-run (wipes data).

**Q: I want to apply a hotfix without rebuilding the image.**
A: For Python code changes:
   ```
   docker exec flexar-zulip-server bash
   # inside container, edit /home/zulip/deployments/current/...
   # then:
   supervisorctl restart all
   ```
   But this is throwaway — the next deploy will overwrite. For real
   changes, commit and push.

## License

This deploy harness is Apache-2.0, matching upstream Zulip and
`zulip/docker-zulip` from which we adapted several files.
