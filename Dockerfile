# Multi-stage build for optimal efficiency
#
# Vite emits plain static files rather than a server, so the runner stage hosts
# them with `serve`, which also supplies the SPA fallback.

# Builder stage
FROM node:22-alpine AS builder

# Add labels for metadata
LABEL maintainer="ruchatest4@gmail.com"
LABEL description="Compliance Portal UI Application"
LABEL version="1.0"

WORKDIR /app

# Install dependencies based on lock file.
# This runs BEFORE `ENV NODE_ENV=production` on purpose: npm skips
# devDependencies when NODE_ENV is production, and vite/oxlint live in
# devDependencies — setting it first makes `npm run build` fail.
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# Copy source files
COPY . .

# Build-time environment variables
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Two independent switches. Vite treats them separately, and conflating them
# hides one behind the other:
#
#   BUILD_MODE -> which env file is read.  production = .env.production (live
#                 API URL), development = .env (localhost API URL).
#   NODE_ENV   -> the value of import.meta.env.DEV, which is what
#                 LoginCheck.jsx gates its manual login form on. `--mode` alone
#                 does NOT affect this; NODE_ENV=production forces DEV=false and
#                 the app redirects to the RUCHA portal instead.
#
# Both default to production, so a plain `docker build` — and Jenkins, which
# passes neither — produces a deployable image.
#
#   Live deploy .............. (no build args)
#   Login form + live API .... --build-arg NODE_ENV=development
#   Login form + local API ... --build-arg NODE_ENV=development \
#                              --build-arg BUILD_MODE=development
ARG BUILD_MODE=production
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Build the application.
#
# The API URL comes from the env file above, loaded by Vite itself — it is
# deliberately NOT set as an ENV here, because a process env var takes priority
# over .env files and would override whatever that file says.
#
# Vite inlines VITE_* into the JS bundle, so the value is fixed at build time:
# changing it means rebuilding, not restarting. A "localhost" value resolves in
# the visitor's browser, not on the server.
RUN npm run build -- --mode ${BUILD_MODE}

# Runner stage
#
# nginx rather than `serve`, because the app needs a server that can proxy, not
# just one that can hand out files. VITE_API_BASE_URL is the relative path
# /compliancePortal/, so API calls arrive at this container and are forwarded to
# the backend from here — same origin, no CORS, and the backend never has to be
# published through the firewall. See nginx.conf.template.
#
# The -unprivileged variant, not the stock nginx image: stock nginx starts as
# root to bind port 80 and drops privileges for its workers. This one runs
# entirely as uid 101 with its pid and temp paths already pointed somewhere
# writable, which is what the previous stage's non-root appuser gave us.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner

# Templates in this directory are rendered by the image's entrypoint at startup,
# with ${BACKEND_URL} substituted from the environment. The filter keeps
# envsubst to that one name so nginx's own $host, $uri and friends survive.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# \$ is an escaped literal dollar — the anchor belongs to the regex, and an
# unescaped one would be read as the start of a Dockerfile variable.
ENV NGINX_ENVSUBST_FILTER="^BACKEND_URL\$"

# Where this container reaches the Spring backend. 172.17.0.1 is the docker0
# gateway — the host as seen from inside a container on the default bridge —
# and 8099 is where the backend deploy publishes itself. This is the same route
# the ETMS UI container uses to reach its own backend.
#
# Overridable at `docker run` time with -e BACKEND_URL=..., so moving the
# backend does not mean rebuilding the image.
ENV BACKEND_URL=http://172.17.0.1:8099

# Built app under /compliance, matching `base` in vite.config.js: the built
# index.html asks for /compliance/assets/..., so the files have to sit at that
# path for the URL to resolve.
#
# No second copy at the root any more. That existed because `serve -s` rewrote
# unmatched paths to the ROOT index.html regardless of their prefix; nginx's
# try_files is path-aware and falls back within /compliance/ itself.
COPY --from=builder /app/dist /usr/share/nginx/html/compliance

# 3000, not 80: an unprivileged user cannot bind anything below 1024. The
# Jenkins deploy maps HOST_PORT to this.
EXPOSE 3000

# 127.0.0.1, not localhost: the container's /etc/hosts maps localhost to ::1 as
# well as 127.0.0.1, so an IPv4-only listener refuses the IPv6 attempt first.
#
# /compliance/ rather than /, so a broken asset path fails the health check
# instead of passing on the redirect that / returns.
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/compliance/ || exit 1

# Inherited from the base image: the entrypoint renders the template, then execs
# nginx in the foreground.
