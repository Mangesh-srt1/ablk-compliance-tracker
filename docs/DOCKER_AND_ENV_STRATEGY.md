# Docker & Environment Configuration Strategy

**Document Purpose:** Explain why we maintain separate Docker Compose files and environment configuration files, and when to use which.

---

## 🐳 Docker Compose Strategy: WHY 2 FILES?

### Files

```
compliance-system/
├── docker-compose.yml           ← Production deployment
└── docker-compose.dev.yml       ← Development with hot-reload
```

### When to Use Each

| Scenario | Command | File | Effect |
|----------|---------|------|--------|
| **Development** | `npm run docker:dev:up` | `docker-compose.dev.yml` | Hot-reload, debug ports, volumes mounted |
| **Production** | `docker-compose -f docker-compose.yml up -d` | `docker-compose.yml` | Optimized, no debug ports, production images |
| **Production** | `docker-compose -f docker-compose.yml down` | `docker-compose.yml` | Shutdown only prod (safety) |

### Key Differences

| Feature | Development (dev.yml) | Production (yml) |
|---------|----------------------|------------------|
| **Hot-reload** | ✅ ts-node-dev watches files | ❌ Compiled binaries only |
| **Debug Ports** | ✅ 9229 (API), 9230 (Agents) | ❌ No debug ports |
| **Volume Mounts** | ✅ `./src/api/src:/app/src` | ❌ No mounts |
| **Image Source** | Local Dockerfile.dev | Pre-built (ghcr.io/...) |
| **Resource Limits** | Loose (for iteration) | Tight (for efficiency) |
| **Logging** | Verbose (LOG_LEVEL=debug) | Standard (LOG_LEVEL=info) |

### Why Separate Files?

1. **Production Safety**
   - Can't accidentally run dev config in production
   - Prevents exposing debug ports to internet
   - Prevents hot-reload overhead in production

2. **Different Requirements**
   - Dev needs volume mounts for code changes
   - Prod needs pre-built images for security
   - Dev wants loose resource limits for iteration
   - Prod wants tight limits for cost

3. **Industry Standard**
   - Docker official docs recommend this pattern
   - Kubernetes manifests (production) ≠ Local development
   - Docker Desktop, AWS, Google Cloud all use this pattern

### ⚠️ Common Mistake

```bash
# ❌ WRONG - Runs production config in dev
docker-compose -f docker-compose.yml up

# ✅ CORRECT - Uses dev file with hot-reload
npm run docker:dev:up
# OR
docker-compose -f docker-compose.dev.yml up
```

---

## 📝 Environment Configuration Strategy: WHY 3 FILES (Not 4)?

### Files Structure

```
Root/
└── .env.example              ← Master template (DO NOT MODIFY FOR PERSONAL USE)

compliance-system/
├── .env                      ← Git-tracked defaults (shared)
├── .env.local                ← Git-ignored overrides (personal)
└── .env.example              ← ❌ REMOVED (duplicate - see root)
```

### Purpose of Each

#### 1. **Root `.env.example`** (Master Template)

- **Purpose:** Reference template for all developers
- **Content:** Default values + documentation
- **Git Tracking:** ✅ Committed to Git
- **Modified When:** New env var added to system (rare)
- **Example:**
  ```env
  # Master template
  DB_USER=postgres
  DB_PASSWORD=postgres          # CHANGE IN .env.local!
  API_PORT=3000                 # Internal port
  API_EXTERNAL_PORT=4000        # External port for dev
  ```

#### 2. **compliance-system/ `.env`** (Shared Defaults)

- **Purpose:** Development environment defaults
- **Content:** Default values suitable for all developers
- **Git Tracking:** ✅ Committed to Git
- **Modified When:** Change shared default (rare)
- **Usage:** Base configuration for `npm run docker:dev:up`
- **Example:**
  ```env
  DB_USER=postgres
  DB_PASSWORD=postgres
  API_EXTERNAL_PORT=4000
  GROK_API_KEY=sk-placeholder   # Placeholder - update in .env.local
  ```

#### 3. **compliance-system/ `.env.local`** (Personal Overrides)

- **Purpose:** Per-developer customizations
- **Content:** Personal API keys, custom ports, local overrides
- **Git Tracking:** ❌ **Git-ignored** (.gitignore entry: `.env.local`)
- **Modified When:** Developer needs personal customization
- **Usage:** Overrides values from `.env`
- **Example (YOUR LOCAL MACHINE):**
  ```env
  # Your personal secrets - NEVER COMMIT
  GROK_API_KEY=sk-your-actual-key-here
  BALLERINE_API_KEY=your-test-key
  DATABASE_URL=postgresql://custom-user:custom-pass@host:5432/db
  ```

### Load Order (Priority)

When Docker Compose starts, it loads (in order):
1. `.env` (base defaults)
2. `.env.local` (overrides from step 1) ← **Highest priority**

```bash
# Example: API_EXTERNAL_PORT resolution
.env:               API_EXTERNAL_PORT=4000
.env.local:         API_EXTERNAL_PORT=4001    ← This wins

# Result: Docker maps to port 4001 (from .env.local)
```

### Why 3 Files (Not 1, Not 2)?

| Approach | Problem |
|----------|---------|
| **1 file (.env)** | Developers would need to edit tracked file, causing merge conflicts |
| **2 files (.env + .env.local)** | New developers don't know what env vars exist → Confusion & errors |
| **3 files (.env + .env.local + .env.example)** | ✅ Clear template + safe defaults + personal overrides |

### 🚨 Common Mistakes

```bash
# ❌ WRONG - Edit shared .env and commit personal secrets
git add compliance-system/.env
git commit -m "Added my API keys"
git push
# Result: Your production API keys are now in GitHub!

# ✅ CORRECT - Create .env.local with personal overrides
echo "GROK_API_KEY=sk-my-key" > compliance-system/.env.local
# Never commit .env.local (it's in .gitignore)

# ✅ CORRECT - Update root .env.example when adding NEW env var
# 1. Add to root/.env.example with description
# 2. Add PLACEHOLDER to compliance-system/.env
# 3. Each developer adds personal value to .env.local
```

### Workflow for Adding New Environment Variables

**Step 1: Root `.env.example` (What's available)**
```env
# NEW: Chainalysis API for blockchain sanctions
CHAINALYSIS_API_KEY=sk-placeholder  # Add description
```

**Step 2: compliance-system/ `.env` (Default/placeholder)**
```env
CHAINALYSIS_API_KEY=sk-placeholder  # All developers see this
```

**Step 3: Each Developer's `.env.local` (Personal value)**
```env
CHAINALYSIS_API_KEY=sk-dev123abcdef  # YOUR personal test key
```

**Step 4: Commit**
```bash
git add root/.env.example compliance-system/.env
git commit -m "feat: Add CHAINALYSIS_API_KEY to env config"
git push
# .env.local automatically excluded (in .gitignore) ✅
```

---

## 📊 Complete Configuration Overview

### Development Session (LOCAL)

```
1. Clone repo
   ↓
2. Copy root/.env.example → compliance-system/.env (already exists)
   ↓
3. Create compliance-system/.env.local with YOUR personal API keys
   ↓
4. Run: npm run docker:dev:up
   ├─ Uses docker-compose.dev.yml
   ├─ Loads .env (defaults)
   ├─ Loads .env.local (your overrides)
   ├─ Starts containers: PostgreSQL, Redis, API (hot-reload), Agents (hot-reload)
   └─ Debug ports 9229, 9230 available
   ↓
5. Edit code in src/api/src
   ├─ ts-node-dev watches files
   ├─ Auto-restarts Express on file change
   └─ No need to rebuild Docker
   ↓
6. Stop: docker-compose -f docker-compose.dev.yml down
```

### Production Deployment (REMOTE)

```
1. Build Docker images (CI/CD pipeline)
   ↓
2. Load docker-compose.yml (production config)
   ├─ No hot-reload
   ├─ No debug ports
   ├─ Optimized for performance
   └─ All secrets from .env file (managed by DevOps)
   ↓
3. Start: docker-compose -f docker-compose.yml up -d
   ├─ Pulls pre-built images from registry
   ├─ Starts containers without volumes
   └─ Logs to centralized system
   ↓
4. Monitor: 
   ├─ Prometheus (metrics)
   ├─ Sentry (error tracking)
   └─ CloudWatch/DataDog (logs)
   ↓
5. Scale: Kubernetes orchestrates replicas
```

---

## ✅ Checklist for New Developers

After cloning the repo:

- [ ] Read this file
- [ ] `cd compliance-system`
- [ ] Verify `.env` exists (should be in repo)
- [ ] Create `.env.local` with YOUR API keys:
  ```bash
  cat > .env.local << EOF
  GROK_API_KEY=sk-your-test-key
  BALLERINE_API_KEY=your-test-key
  EOF
  ```
- [ ] Run `npm run docker:dev:up`
- [ ] Verify services start (check Docker Desktop)
- [ ] Test API: `curl http://localhost:4000/health`
- [ ] Edit code and watch hot-reload in action
- [ ] Never commit `.env.local` (it's automatically ignored)

---

## 🔗 Related Documentation

- [DOCKER_DEVELOPMENT.md](../DOCKER_DEVELOPMENT.md) - Detailed Docker setup guide
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Git workflow & commit conventions
- [copilot-instructions.md](../.github/copilot-instructions.md) - AI/developer instructions
