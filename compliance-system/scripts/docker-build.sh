#!/bin/bash
# Docker Build Script for Ableka Lumina
# Phase 5 Week 21 Day 1 - Production Docker Images
set -euo pipefail

# Configuration
REGISTRY="${REGISTRY:-}"
REPO_NAME="${REPO_NAME:-lumina}"
TAG="${TAG:-latest}"
# Default platform is linux/amd64. Override with PLATFORM=linux/arm64 on Apple Silicon or other ARM hosts.
PLATFORM="${PLATFORM:-linux/amd64}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
warn()  { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2; exit 1; }

# Determine script directory (repo root of compliance-system)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

log "Building Ableka Lumina Docker images (tag: ${TAG})"
log "Platform: ${PLATFORM}"

# Build function
build_image() {
    local service=$1
    local context=$2
    local dockerfile="${context}/Dockerfile"
    local image_name="${REPO_NAME}-${service}:${TAG}"

    if [ -n "${REGISTRY}" ]; then
        image_name="${REGISTRY}/${image_name}"
    fi

    log "Building ${service} image..."
    docker build \
        --platform "${PLATFORM}" \
        --file "${dockerfile}" \
        --tag "${image_name}" \
        --progress=plain \
        "${context}"

    log "✅ Built: ${image_name}"

    # Push if registry is configured
    if [ -n "${REGISTRY}" ]; then
        log "Pushing ${image_name}..."
        docker push "${image_name}"
        log "✅ Pushed: ${image_name}"
    fi
}

# Build images
build_image "api"    "${ROOT_DIR}/src/api"
build_image "agents" "${ROOT_DIR}/src/agents"
build_image "ui"     "${ROOT_DIR}/src/dashboard"

log "🎉 All images built successfully!"

# Output image manifest
cat > "${ROOT_DIR}/image-manifest.json" << EOF
{
  "version": "${TAG}",
  "build_date": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "images": {
    "api":    "${REPO_NAME}-api:${TAG}",
    "agents": "${REPO_NAME}-agents:${TAG}",
    "ui":     "${REPO_NAME}-ui:${TAG}"
  }
}
EOF

log "Image manifest written to image-manifest.json"
