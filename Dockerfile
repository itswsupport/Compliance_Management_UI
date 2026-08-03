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
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Static file server. `-s` rewrites every unmatched path to index.html, so
# client-side routes like /compliance/comp-admin/pending survive a refresh
# instead of 404ing. serve gzips on its own.
RUN npm install -g serve@14 --no-audit --no-fund

# Create system user and group
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy built application into a /compliance subdirectory, matching `base` in
# vite.config.js: the built index.html asks for /compliance/assets/..., so the
# files have to sit at that path for the URL to resolve.
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist/compliance

# A second copy of index.html at the served root. `serve -s` rewrites any
# unmatched path to /index.html — the ROOT one, it is not path-aware — so
# without this a refresh on /compliance/comp-admin/pending 404s. This copy
# still references /compliance/assets/..., so the app boots correctly and
# BrowserRouter's basename picks the route back up from the URL.
COPY --from=builder --chown=appuser:nodejs /app/dist/index.html ./dist/index.html

# Switch to non-root user
USER appuser

# Expose port
# 3000, not 80: an unprivileged user cannot bind anything below 1024.
EXPOSE 3000

# Runtime environment variables
ENV PORT=3000

# Health check
# 127.0.0.1, not localhost: the container's /etc/hosts maps localhost to ::1 as
# well as 127.0.0.1, so an IPv4-only listener refuses the IPv6 attempt first.
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1

# Start the application
CMD ["serve", "-s", "dist", "-l", "3000"]
