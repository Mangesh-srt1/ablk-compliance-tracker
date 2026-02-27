# Docker Development Environment Guide

## Overview

This guide covers the development Docker environment for Ableka Lumina. The setup enables rapid iteration with hot-reload, live debugging, and full service integration.

### Environment Files

Create `.env.local` in the project root for development overrides:

```bash
# .env.local (LOCAL DEVELOPMENT ONLY - Never commit)
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=compliance_db
DB_PORT=5432
REDIS_PORT=6379
REDIS_HOST=localhost

# External APIs (use test/sandbox credentials)
GROK_API_KEY=sk-test-key-placeholder
BALLERINE_API_KEY=test-key
MARBLE_API_KEY=test-key
CHAINALYSIS_API_KEY=test-key

# JWT  
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRY=15m

# Logging
LOG_LEVEL=debug
NODE_ENV=development

# Blockchain (optional - enable if testing integration)
BLOCKCHAIN_TYPE=permissioned
# BESU_RPC_URL=http://besu:8545
# BESU_CHAIN_ID=1337
```

## Quick Start (One Command)

```bash
# Start all containers with hot-reload
docker-compose -f compliance-system/docker-compose.dev.yml up

# All services will be available at:
# - API: http://localhost:3000
# - Agents: http://localhost:3002
# - Dashboard: http://localhost:3001
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
```

## Service-Specific Commands

### Start all services
```bash
docker-compose -f compliance-system/docker-compose.dev.yml up
```

### Start individual services
```bash
# API only
docker-compose -f compliance-system/docker-compose.dev.yml up api

# Agents only
docker-compose -f compliance-system/docker-compose.dev.yml up agents

# Dashboard only
docker-compose -f compliance-system/docker-compose.dev.yml up dashboard

# Infrastructure only (PostgreSQL + Redis)
docker-compose -f compliance-system/docker-compose.dev.yml up postgres redis
```

### Run in detached mode (background)
```bash
docker-compose -f compliance-system/docker-compose.dev.yml up -d
```

### View logs
```bash
# All services
docker-compose -f compliance-system/docker-compose.dev.yml logs -f

# Specific service
docker-compose -f compliance-system/docker-compose.dev.yml logs -f api
docker-compose -f compliance-system/docker-compose.dev.yml logs -f agents
docker-compose -f compliance-system/docker-compose.dev.yml logs -f dashboard

# Last 100 lines
docker-compose -f compliance-system/docker-compose.dev.yml logs -f --tail=100
```

### Stop services
```bash
# Stop all
docker-compose -f compliance-system/docker-compose.dev.yml down

# Stop with volume cleanup
docker-compose -f compliance-system/docker-compose.dev.yml down -v
```

### Rebuild containers after dependency changes
```bash
docker-compose -f compliance-system/docker-compose.dev.yml up --build
```

## Hot-Reload Development

### API Service (Express.js)
- **Technology**: ts-node-dev
- **Behavior**: Automatically restarts when src files change
- **Port**: 3000 (API), 9229 (Debugger)
- **Watch Pattern**: Ignores `node_modules/`

### Agents Service (LangChain.js)
- **Technology**: ts-node-dev
- **Behavior**: Automatically restarts when src files change
- **Port**: 3002 (Service), 9230 (Debugger)
- **Watch Pattern**: Ignores `node_modules/`

### Dashboard (React + Vite)
- **Technology**: Vite dev server with HMR (Hot Module Replacement)
- **Behavior**: Updates in-browser without full reload
- **Port**: 3001 (Frontend), 5173 (Vite dev server)
- **HMR**: Enabled automatically

## Debugging

### Node Inspector (Chrome DevTools)

1. Start containers with `docker-compose -f compliance-system/docker-compose.dev.yml up`
2. Services expose debugger ports:
   - API: `http://localhost:9229`
   - Agents: `http://localhost:9230`
3. Open Chrome DevTools: `chrome://inspect`
4. Click "Inspect" on the running Node process
5. Set breakpoints and debug

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API (Docker)",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "localRoot": "${workspaceFolder}/compliance-system/src/api",
      "remoteRoot": "/app"
    },
    {
      "name": "Debug Agents (Docker)",
      "type": "node",
      "request": "attach",
      "port": 9230,
      "localRoot": "${workspaceFolder}/compliance-system/src/agents",
      "remoteRoot": "/app"
    }
  ]
}
```

Then use "Debug API (Docker)" launch configuration in VS Code.

### Logs and Debugging

```bash
# View logs with timestamps
docker-compose -f compliance-system/docker-compose.dev.yml logs --timestamps

# Follow specific service with grep filter
docker-compose -f compliance-system/docker-compose.dev.yml logs -f api | grep ERROR

# Export logs to file
docker-compose -f compliance-system/docker-compose.dev.yml logs > debug.log
```

## Database Management

### Access PostgreSQL

```bash
# From host machine
psql -h localhost -U postgres -d compliance_db

# Inside container
docker-compose -f compliance-system/docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db
```

### Run Database Migrations

```bash
# Inside API container
docker-compose -f compliance-system/docker-compose.dev.yml exec api npm run migrate

# Or from host if npm is available
npm run db:migrate
```

### Reset Database

```bash
# Remove volume and recreate
docker-compose -f compliance-system/docker-compose.dev.yml down -v
docker-compose -f compliance-system/docker-compose.dev.yml up postgres
# Wait for initialization, then:
docker-compose -f compliance-system/docker-compose.dev.yml up
```

## Redis Cache Management

### Connect to Redis

```bash
# Inside API/Agents container
docker-compose -f compliance-system/docker-compose.dev.yml exec redis redis-cli

# From host machine (if redis-cli installed)
redis-cli -h localhost -p 6379
```

### Common Redis Commands

```bash
# Ping Redis
PING

# Get all keys
KEYS *

# Clear all cache
FLUSHALL

# Monitor real-time operations
MONITOR

# Check Redis info
INFO
```

## Testing Services

### Health Check Status

```bash
# Check all service health
docker-compose -f compliance-system/docker-compose.dev.yml ps

# Specific service health
docker-compose -f compliance-system/docker-compose.dev.yml logs postgres | grep health
```

### API Testing

```bash
# Test API health endpoint
curl http://localhost:3000/health

# Expected response:
# {"status":"healthy","uptime":123.45,"timestamp":"2026-02-26T..."}
```

### Database Connection

```bash
# Verify PostgreSQL is accessible
docker-compose -f compliance-system/docker-compose.dev.yml exec postgres pg_isready
```

### Redis Connection

```bash
# Verify Redis is accessible
docker-compose -f compliance-system/docker-compose.dev.yml exec redis redis-cli ping
# Expected: PONG
```

## Performance Considerations

### Volume Mounting

The development compose mounts source directories for hot-reload:

```yaml
volumes:
  - ./compliance-system/src/api/src:/app/src  # Host:Container
  - /app/node_modules  # Don't shadow container node_modules
```

This allows real-time code updates without rebuilding containers.

### Memory and CPU

Development containers have reasonable defaults:
- API: 768MB RAM, 1 CPU
- Agents: 2GB RAM, 2 CPU (LLM operations)
- Dashboard: 1GB RAM, 1 CPU
- PostgreSQL: 1GB RAM, 1 CPU
- Redis: 512MB RAM, 0.5 CPU

Adjust if system is constrained in `docker-compose.dev.yml`.

## Common Issues & Solutions

### Port Already in Use

```bash
# Find and kill process using port
lsof -i :3000  # Find process on port 3000
kill -9 <PID>  # Kill the process

# Or change port in docker-compose.dev.yml
# Then rebuild: docker-compose up --build
```

### Container Won't Start

```bash
# Check container logs
docker-compose -f compliance-system/docker-compose.dev.yml logs api

# Rebuild without cache
docker-compose -f compliance-system/docker-compose.dev.yml up --build --no-cache
```

### Database Connection Failed

```bash
# Ensure PostgreSQL is healthy
docker-compose -f compliance-system/docker-compose.dev.yml logs postgres

# Wait for database to be ready
# Retry API startup: docker-compose -f compliance-system/docker-compose.dev.yml up api
```

### Node Modules Issues

```bash
# Clear node_modules and reinstall
docker-compose -f compliance-system/docker-compose.dev.yml down -v
docker system prune -a
docker-compose -f compliance-system/docker-compose.dev.yml up --build
```

## npm Scripts (from project root)

```bash
# Start development environment
npm run docker:dev:up

# Stop development environment
npm run docker:dev:down

# View logs
npm run docker:dev:logs

# One-liner to setup and start
npm run bootstrap && npm run docker:dev:up
```

## Production Compose

When ready for production, use `compliance-system/docker-compose.yml` (without `.dev`):

```bash
# Production deployment
docker-compose -f compliance-system/docker-compose.yml up -d

# Key differences from dev:
# - Images pulled from registry (not built locally)
# - No hot-reload or debugging
# - Reduced logging
# - Resource limits enforced
# - No volume mounts (immutable containers)
```

## File Structure

```
ablk-compliance-tracker/
├── docker-compose.dev.yml         # Development (hot-reload)
├── compliance-system/
│   ├── docker-compose.yml         # Production
│   └── src/
│       ├── api/
│       │   ├── Dockerfile         # Production image
│       │   ├── Dockerfile.dev     # Development image (hot-reload)
│       │   └── src/
│       ├── agents/
│       │   ├── Dockerfile         # Production image
│       │   ├── Dockerfile.dev     # Development image (hot-reload)
│       │   └── src/
│       └── dashboard/
│           ├── Dockerfile         # Production image
│           ├── Dockerfile.dev     # Development image (Vite HMR)
│           └── src/
└── .env.example                   # Example env vars
    .env.local                      # Development overrides (not in git)
```

## Checklist: First-Time Setup

- [ ] Copy `.env.example` to `.env` (for production defaults)
- [ ] Create `.env.local` with development overrides
- [ ] Run `npm run bootstrap` (installs dependencies, sets up Husky)
- [ ] Run `npm run docker:dev:up` to start services
- [ ] Verify all services are healthy: `docker-compose -f compliance-system/docker-compose.dev.yml ps`
- [ ] Test API: `curl http://localhost:3000/health`
- [ ] View Dashboard: `http://localhost:3001` (should appear after 30 seconds)
- [ ] Check logs for errors: `docker-compose -f compliance-system/docker-compose.dev.yml logs`

## Next Steps

1. **Run database migrations** (Week 2):
   ```bash
   npm run db:migrate
   ```

2. **Execute integration tests**:
   ```bash
   npm run test:integration
   ```

3. **Debug with Chrome DevTools**:
   - Go to `chrome://inspect` while containers running
   - Set breakpoints in Node code
   - Step through execution

## Support

For issues not covered here, refer to:
- Docker docs: https://docs.docker.com
- docker-compose docs: https://docs.docker.com/compose
- ts-node-dev: https://github.com/whitecolor/ts-node-dev
- Vite HMR: https://vitejs.dev/guide/hmr.html

---

**Last Updated**: February 26, 2026
**Document Version**: 1.0 (Development Environment)
