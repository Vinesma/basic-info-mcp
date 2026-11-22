# syntax=docker/dockerfile:1

# ---- Base: install dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .env ./
RUN npm ci

# ---- Build: typecheck ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json .env ./
COPY src ./src
COPY test ./test
COPY tsconfig.json ./
RUN npm run typecheck

# ---- Runtime: production image ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV DOCKER=yes
WORKDIR /app
# Install runtime deps and copy typecheck output (if any emitted files exist).
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json .env ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/test ./test
EXPOSE 8080
# Run as a non-root user.
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r => r.json()).then(j => process.exit(j.jsonrpc ? 0 : 1)).catch(() => process.exit(1))"
CMD ["npm", "start"]
