# Flexar Zulip — deploy

This directory contains everything needed to build the Flexar Zulip Docker
image from this fork and deploy it via GitHub Actions, mirroring the
pattern used by `polymarket_bots`.

## Files

| File | Purpose |
|---|---|
| `Dockerfile` | Two-stage build; produces ARM64 image from forked source via `COPY` |
| `docker-compose.yml` | 5-service stack: postgres, memcached, rabbitmq, redis, zulip |
| `entrypoint.sh` | Zulip startup script (vendored from upstream `docker-zulip`) |
| `manage.py` | Helper for `docker exec ... manage.py` (vendored) |
| `upgrade-postgresql` | PG major-version upgrade helper (vendored) |
| `deploy_zulip.sh` | Runs on the server; pulls image + recreates compose stack |
| `.env.example` | Template for local + server env files |
| `.dockerignore` | Excludes from build context (real one lives at repo root) |
| `custom_zulip_files/` | Drop-in for site-customizations |

CI workflow lives at `.github/workflows/flexar-deploy.yml`.

## Architecture

```
GitHub push  →  GH Actions runner (ubuntu-22.04, qemu-emulated arm64)
                    │
                    ├─ docker buildx build → linux/arm64 image
                    ├─ docker push cr.yandex/$REGISTRY/flexar-zulip-server:$SHA
                    │
                    ├─ scp deploy_zulip.sh → deploy@<host>
                    └─ ssh deploy@<host> 'deploy_zulip.sh ...'
                                                        │
                                            ┌───────────┴───────────┐
                                            │ docker compose up -d  │
                                            └───────────┬───────────┘
                                                        │
                              ┌─────────────────────────┼─────────────────────────┐
                              ▼                         ▼                         ▼
                       database (PG14)            redis / memcached / rabbitmq  
                                                                                  
                                                  zulip server:80,443 ────► host 8800, 8843
```

## First-time setup

### 1. Yandex Container Registry

Either reuse the registry already used by polymarket_bots (same
`YC_REGISTRY_ID`, just a new container/repo name) or create a fresh one:

```bash
yc container registry create --name flexar-zulip
yc container registry get flexar-zulip   # note the ID
```

The container repo (image name) can be `flexar-zulip-server`. The registry
auto-creates it on first push.

### 2. Service account for CI/CD

If you don't already have one for polymarket:

```bash
yc iam service-account create --name flexar-ci
SA_ID=$(yc iam service-account get flexar-ci --format json | jq -r .id)
yc container registry add-access-binding flexar-zulip \
    --role container-registry.images.pusher --service-account-id $SA_ID
yc iam key create --service-account-id $SA_ID --output flexar-ci-key.json
```

The `flexar-ci-key.json` content becomes `YC_SA_JSON_CREDENTIALS` secret.

### 3. SSH key for deploy user on the VM

Either reuse polymarket's `VM_SSH_PRIVATE_KEY` (the deploy user is the same)
or generate a new key pair and add the public key to
`/home/deploy/.ssh/authorized_keys` on the server.

### 4. GitHub repository secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**
and add ALL of the following:

#### Yandex Container Registry

| Secret | Example value |
|---|---|
| `YC_SA_JSON_CREDENTIALS` | Full JSON content of `flexar-ci-key.json` |
| `YC_REGISTRY_ID` | `crpXXXXXXXXX` (12-char registry ID) |
| `YC_ZULIP_CONTAINER_NAME` | `flexar-zulip-server` |

#### VM access

| Secret | Example value |
|---|---|
| `VM_HOST` | `<host>` |
| `VM_USER` | `deploy` |
| `VM_SSH_PRIVATE_KEY` | Full content of the private SSH key |

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
| `ZULIP_EXTERNAL_HOST` | `<host>:8843` |
| `ZULIP_ADMIN_EMAIL` | `admin@your-domain.example` |
| `ZULIP_HTTP_PORT` | `8800` |
| `ZULIP_HTTPS_PORT` | `8843` |

#### Optional (outgoing email — required for inviting users)

| Secret | Example value |
|---|---|
| `ZULIP__EMAIL_PASSWORD` | SMTP password |
| `SETTING_EMAIL_HOST` | `smtp.yandex.ru` |
| `SETTING_EMAIL_HOST_USER` | `noreply@your-domain.example` |
| `SETTING_EMAIL_PORT` | `587` |
| `SETTING_EMAIL_USE_TLS` | `True` |
| `SETTING_NOREPLY_EMAIL_ADDRESS` | `noreply@your-domain.example` |

#### Optional (advanced)

| Secret | Example value |
|---|---|
| `ZULIP_AUTH_BACKENDS` | `EmailAuthBackend` (default), or `EmailAuthBackend,GoogleAuthBackend,...` |
| `CERTIFICATES` | `self-signed` (default), or `mounted` if you wire real certs |
| `LOADBALANCER_IPS` | If you put Zulip behind another nginx — its IP |
| `TRUST_GATEWAY_IP` | `true` if behind a trusted reverse-proxy |
| `NGINX_WORKERS` | `2` (default — appropriate for <deploy-host>) |
| `AUTO_BACKUP_ENABLED` | `false` (default — we manage backups separately) |

### 5. First run

```
GitHub UI → Actions → "Flexar Zulip — Deploy" → "Run workflow"
```

The first build will take **30-90 minutes** because:

- All ARM64 layers are built from scratch under qemu emulation
- Zulip's `tools/provision` installs hundreds of OS, Python, and Node deps
- Static asset compilation (webpack) is single-threaded

Subsequent builds reuse the registry build cache and should finish in
**10-20 minutes**.

The first deploy on the server also includes:

- `postgres` initdb + first migrations (~2 min)
- nginx + supervisord cold start (~30 sec)
- Initial static-asset collection (~1 min)

Plan for **~5-10 minutes from "image pulled" to "Zulip responsive"** on first
boot. Subsequent restarts are fast.

### 6. After first deploy succeeds

- Open `https://<host>:8843/` — accept the self-signed cert.
- Create the first organization (realm):
  ```
  ssh user@<host>
  sudo -u deploy docker exec -it flexar-zulip-server \
      /home/zulip/deployments/current/manage.py generate_realm_creation_link
  ```
  Follow the link in your browser, register the admin user, done.

### 7. Subsequent deploys

Just push to `main` (touching any file matched by the workflow's `paths`
filter). GH Actions:
1. Rebuilds the image (cache hits → fast)
2. Pushes to cr.yandex
3. SSHes to the server, runs `deploy_zulip.sh`
4. Server pulls and recreates the `zulip` container

The compose stack uses `unless-stopped` restart policy; sidecars (db,
redis, etc.) persist their data via named volumes.

## Local development

To build and run the stack on your laptop (Apple Silicon, Linux/arm64):

```bash
cd <your-clone>

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

**Q: Build takes forever (>2h) on GH Actions.**
A: First build always slow due to qemu. After it caches into the registry,
   subsequent builds drop to 10-20 min. If the runner times out (180 min),
   re-trigger — it will pick up cached layers.

**Q: `Permission denied` on volumes / `/data` not writable.**
A: Volumes are managed by Docker — Zulip runs as user `zulip` (uid 1000)
   inside the container. If you bind-mount from the host, ensure host
   directory owner uid is 1000.

**Q: Self-signed cert warning.**
A: Expected. For production, switch `CERTIFICATES=mounted` and bind a
   real Let's Encrypt cert at `/etc/letsencrypt`.

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
