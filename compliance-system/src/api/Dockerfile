# ================================
# Build Stage
# ================================
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ dumb-init

WORKDIR /app

# Copy package files for dependency caching
COPY package*.json ./

# Install all dependencies (including dev) for build
RUN npm install && npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ================================
# Production Stage
# ================================
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache dumb-init curl \
    && addgroup -g 1001 -S lumina \
    && adduser -S lumina -u 1001 -G lumina

WORKDIR /app

# Copy production node_modules from builder
COPY --from=builder --chown=lumina:lumina /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=lumina:lumina /app/dist ./dist
COPY --from=builder --chown=lumina:lumina /app/package*.json ./

# Copy SQL files and locales needed at runtime
COPY --chown=lumina:lumina src/sql ./src/sql
COPY --chown=lumina:lumina src/locales ./src/locales

# Create directories
RUN mkdir -p /app/logs /app/uploads && chown -R lumina:lumina /app/logs /app/uploads

USER lumina

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]