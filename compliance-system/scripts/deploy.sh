#!/bin/bash
# Deployment Script for Ableka Lumina
# Phase 5 Week 21 - Production Deployment
set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-production}"
TAG="${TAG:-latest}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
warn()  { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

log "Deploying Ableka Lumina (env: ${ENVIRONMENT}, tag: ${TAG})"

# Validate required env vars for production
if [ "${ENVIRONMENT}" = "production" ]; then
    required_vars=(
        "JWT_SECRET"
        "ENCRYPTION_KEY"
        "DB_HOST"
        "DB_NAME"
        "DB_USER"
        "DB_PASSWORD"
    )
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            error "Required environment variable ${var} is not set"
        fi
    done
fi

# Choose compose file
if [ "${ENVIRONMENT}" = "production" ]; then
    COMPOSE_FILE="${ROOT_DIR}/docker-compose.prod.yml"
else
    COMPOSE_FILE="${ROOT_DIR}/docker-compose.dev.yml"
fi

if [ ! -f "${COMPOSE_FILE}" ]; then
    error "Docker Compose file not found: ${COMPOSE_FILE}"
fi

log "Using compose file: ${COMPOSE_FILE}"

# Pull latest images
log "Pulling latest images..."
TAG="${TAG}" docker-compose -f "${COMPOSE_FILE}" pull --ignore-pull-failures || warn "Some images could not be pulled"

# Deploy
log "Starting services..."
TAG="${TAG}" docker-compose -f "${COMPOSE_FILE}" up -d --remove-orphans

# Wait for health checks
log "Waiting for services to become healthy..."
sleep 10

# Check service health
services=("lumina-api" "lumina-agents")
for service in "${services[@]}"; do
    if docker ps --format "{{.Names}}" | grep -q "${service}"; then
        health=$(docker inspect "${service}" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0].get('State',{}).get('Health',{}).get('Status','unknown'))" 2>/dev/null || echo "unknown")
        log "Service ${service}: ${health}"
    fi
done

log "✅ Deployment complete!"
log "API:    http://localhost:4000"
log "Agents: http://localhost:4002"
