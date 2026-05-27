# ============================================================
# BOLAMU — Dockerfile Multi-Stage (Sprint 5)
# ============================================================

# Stage 1 — Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Stage 2 — Production
FROM node:20-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S bolamu -u 1001
WORKDIR /app
COPY --from=builder --chown=bolamu:nodejs /app/node_modules ./node_modules
COPY --chown=bolamu:nodejs . .
USER bolamu
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/test', \
  (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"
CMD ["node", "src/server.js"]
