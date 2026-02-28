# ================================
# Build Stage
# ================================
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ dumb-init

WORKDIR /app

COPY package*.json ./
RUN npm install && npm cache clean --force

COPY . .
RUN npm run build
RUN npm prune --production

# ================================
# Production Stage
# ================================
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init curl \
    && addgroup -g 1001 -S lumina \
    && adduser -S lumina -u 1001 -G lumina

WORKDIR /app

COPY --from=builder --chown=lumina:lumina /app/node_modules ./node_modules
COPY --from=builder --chown=lumina:lumina /app/dist ./dist
COPY --from=builder --chown=lumina:lumina /app/package*.json ./

# Copy jurisdiction config YAMLs needed at runtime
COPY --chown=lumina:lumina src/config ./src/config

RUN mkdir -p /app/logs && chown -R lumina:lumina /app/logs

USER lumina

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]