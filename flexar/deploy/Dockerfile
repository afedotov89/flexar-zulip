# syntax=docker/dockerfile:1.6
# Flexar Zulip Server image.
#
# Adapted from upstream zulip/docker-zulip (Apache-2.0):
#   https://github.com/zulip/docker-zulip/blob/main/Dockerfile
#
# Key differences vs upstream:
#   - Source is COPYed from this repo (build context root), not cloned.
#     Lets us build a private fork without injecting GitHub credentials.
#   - Default platform target is linux/arm64 (Raspberry Pi 5 host).
#     Multi-arch builds via `docker buildx build --platform linux/arm64,linux/amd64`.
#   - Build context MUST be the repository root (not flexar/deploy/),
#     because we need to COPY the full Zulip source tree.
#     Build invocation:
#       docker build -f flexar/deploy/Dockerfile -t flexar-zulip:dev .
#
# This is a 2-stage build:
#   1. `build` stage: provision Zulip dev env, then `build-release-tarball`
#      produces a deploy tarball.
#   2. final stage: install the tarball via `scripts/setup/install` with
#      Docker-specific puppet class.

FROM ubuntu:24.04 AS base

ENV LANG="C.UTF-8"

ARG UBUNTU_MIRROR

# hadolint ignore=DL3005,DL3008,DL3009
RUN apt-get -q update && \
    apt-get -q dist-upgrade -y && \
    DEBIAN_FRONTEND=noninteractive \
    apt-get -q install --no-install-recommends -y \
      ca-certificates git locales python3 sudo tzdata curl && \
    touch /var/mail/ubuntu && chown ubuntu /var/mail/ubuntu && userdel -r ubuntu && \
    useradd -d /home/zulip -m zulip -u 1000

# ------------------------------------------------------------
# Build stage: provision dev environment, produce release tarball.
# ------------------------------------------------------------
FROM base AS build

RUN echo 'zulip ALL=(ALL:ALL) NOPASSWD:ALL' >> /etc/sudoers

USER zulip
WORKDIR /home/zulip

ARG FLEXAR_VERSION="dev"
LABEL org.opencontainers.image.source="https://github.com/afedotov89/flexar-zulip"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.title="Flexar Zulip Server (fork)"
LABEL org.opencontainers.image.version="$FLEXAR_VERSION"

# Copy the entire forked source tree from the build context.
# .dockerignore controls what gets included (excludes .git, node_modules, etc.).
COPY --chown=zulip:zulip . /home/zulip/zulip

WORKDIR /home/zulip/zulip

# tools/provision and tools/build-release-tarball require a valid git
# repository: provision blocks if `.git` is missing; build-release-tarball
# uses `git rev-parse HEAD` for GITID and `git archive HEAD` to produce
# the source tarball. We deliberately exclude upstream `.git` from the
# build context (~1 GB), so reconstruct a minimal one-commit history
# inside the image. This keeps the build context lean while satisfying
# both tools.
RUN git config --global user.email "build@flexar.local" && \
    git config --global user.name "Flexar Build" && \
    git config --global init.defaultBranch flexar-build && \
    git init -q && \
    git add -A && \
    git commit -q -m "flexar build snapshot" --no-gpg-sign

# Provision dev env (installs all build-time deps) and produce a release tarball.
RUN SKIP_VENV_SHELL_WARNING=1 ./tools/provision --build-release-tarball-only && \
    uv run --no-sync ./tools/build-release-tarball docker && \
    mv /tmp/tmp.*/zulip-server-docker.tar.gz /tmp/zulip-server-docker.tar.gz

# ------------------------------------------------------------
# Final stage: clean image with installed Zulip.
# ------------------------------------------------------------
FROM base

ENV DATA_DIR="/data"

COPY --from=build /tmp/zulip-server-docker.tar.gz /root/
COPY flexar/deploy/custom_zulip_files/ /root/custom_zulip

WORKDIR /root
RUN \
    # Make sure Nginx is started by Supervisor, not via SysV init script
    # (won't work in container).
    dpkg-divert --add --rename /etc/init.d/nginx && \
    ln -s /bin/true /etc/init.d/nginx && \
    mkdir -p "$DATA_DIR" && \
    tar -xf zulip-server-docker.tar.gz && \
    rm -f zulip-server-docker.tar.gz && \
    mv zulip-server-docker zulip && \
    cp -rf /root/custom_zulip/* /root/zulip 2>/dev/null || true && \
    rm -rf /root/custom_zulip && \
    /root/zulip/scripts/setup/install --hostname="docker-zulip.local" --email="docker-zulip" \
      --puppet-classes="zulip::profile::docker" --postgresql-version=14 && \
    rm -f /etc/zulip/zulip-secrets.conf /etc/zulip/settings.py && \
    apt-get -qq autoremove --purge -y && \
    apt-get -qq clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY flexar/deploy/entrypoint.sh /sbin/entrypoint.sh

VOLUME ["$DATA_DIR"]
EXPOSE 25 80 443

HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=600s \
    CMD curl -isfL --insecure http://localhost/health || exit 1

ENTRYPOINT ["/sbin/entrypoint.sh"]
CMD ["app:run"]
