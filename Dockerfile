# Multi-stage build for BrainSAIT OCR
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Development image with all dependencies
FROM base AS dev-deps  
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 brainsait

# Copy necessary files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder --chown=brainsait:nodejs /app/src ./src
COPY --from=builder --chown=brainsait:nodejs /app/public ./public
COPY --chown=brainsait:nodejs package.json ./
COPY --chown=brainsait:nodejs wrangler.toml ./
COPY --chown=brainsait:nodejs schema.sql ./

USER brainsait

EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8787/health || exit 1

# Default command
CMD ["npx", "wrangler", "dev", "src/worker.js", "--port", "8787", "--host", "0.0.0.0"]