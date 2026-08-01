# Multi-stage build for optimal efficiency
FROM node:22-alpine AS deps

# Add labels for metadata
LABEL maintainer="ruchatest4@gmail.com"
LABEL description="Compliance Portal UI Application"
LABEL version="1.0"

WORKDIR /app

# Install dependencies based on lock file
COPY package.json package-lock.json ./
RUN npm ci --only=production --legacy-peer-deps --no-audit --no-fund

# Builder stage
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# Copy source files
COPY . .

# Build-time environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Make API URL configurable at build time
ARG VITE_API_BASE_URL=https://replportal.co.in:8443/compliancePortal/
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Build the application
RUN npm run build

# Runner stage
FROM nginx:1.27-alpine AS runner

# Server configuration.
# Uses the same filename as the base image's stock config so it is replaced —
# renaming this file would leave the default site serving on port 80.
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
# 127.0.0.1, not localhost: the container's /etc/hosts maps localhost to ::1 as
# well as 127.0.0.1, busybox wget tries IPv6 first, and `listen 80` is IPv4-only
# — so `localhost` here fails with "connection refused" on a healthy container.
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

# Start the application
CMD ["nginx", "-g", "daemon off;"]
