# Simple Node.js container for BrainSAIT OCR
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY src/ ./src/
COPY public/ ./public/
COPY wrangler.toml schema.sql ./

# Create non-root user
RUN addgroup -g 1001 -S brainsait && \
    adduser -S brainsait -u 1001 -G brainsait

# Change ownership
RUN chown -R brainsait:brainsait /app

USER brainsait

EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8787/health || exit 1

# Default command
CMD ["npx", "wrangler", "dev", "src/worker.js", "--port", "8787", "--host", "0.0.0.0"]