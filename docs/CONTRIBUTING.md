# Contributing to Ableka Lumina

Welcome to the Ableka Lumina development team! This guide covers our development workflow, branch strategy, and coding standards.

---

## 🌳 Git Workflow & Branch Strategy

### Branch Structure

```
main (production-ready) ← Always tested, always deployable
  ↑
  └── staging (integration testing)
       ↑
       └── develop (development, daily builds)
            ↑
            └── feature/* or bugfix/* (individual work)
```

### Branch Types & Naming Conventions

**Main Branch** (`main`)
- Production-ready code only
- Protected: requires PR review + all tests passing
- Deployment happens from this branch
- Never commit directly

**Staging Branch** (`staging`)
- Integration testing environment
- Merged from develop after testing
- Pre-production validation
- Protected: requires PR review

**Develop Branch** (`develop`)
- Main development branch
- Daily builds happen here
- Not protected but code review recommended
- Merges from feature/bugfix branches

**Feature Branches** (from `develop`)
```
feature/kyc-verification-service
feature/aml-risk-scoring-engine
feature/blockchain-monitoring
feature/dashboard-ui
```
- Naming: `feature/[feature-name]`
- Lowercase, hyphens instead of spaces
- Clear, descriptive names
- One feature per branch

**Bugfix Branches** (from `develop`)
```
bugfix/fix-jwt-expiry-bug
bugfix/improve-error-messaging
bugfix/memory-leak-in-agent
```
- Naming: `bugfix/[short-description]`
- Include issue number if available: `bugfix/issue-123-fix-jwt`

**Hotfix Branches** (from `main`)
```
hotfix/critical-security-patch
hotfix/database-migration-error
```
- Naming: `hotfix/[critical-issue]`
- Only for critical production issues
- Merged to both `main` and `develop`

### Creating a Feature Branch

```bash
# 1. Ensure you're on develop and up to date
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/kyc-service

# 3. Push to remote
git push origin feature/kyc-service

# 4. Work on your feature, commit regularly
# ... make changes ...
git add .
git commit -m "feat: implement KYC verification with Ballerine"
git push origin feature/kyc-service

# 5. When ready, create Pull Request on GitHub
```

---

## 📝 Commit Message Conventions

### Format

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

### Type

Must be one of:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring without feature changes
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **ci**: CI/CD pipeline changes
- **chore**: Build process, dependencies, tooling

### Scope

The part of the codebase affected:

- `kyc` - KYC service
- `aml` - AML service
- `agents` - AI agents
- `api` - API gateway
- `db` - Database
- `auth` - Authentication/RBAC
- `config` - Configuration
- `docker` - Docker/infrastructure
- `docs` - Documentation

### Subject

- Imperative, present tense: "add" not "added" or "adds"
- Don't capitalize first letter
- No period (.) at the end
- Maximum 50 characters
- Clear and descriptive

### Body

- Wrap at 72 characters
- Explain **what** and **why**, not **how**
- Separate from subject with blank line
- Optional, but recommended for non-trivial changes

### Footer

- Reference issues: `closes #123`, `fixes #456`
- Break changes: `BREAKING CHANGE: description`

### Examples

**Simple commit**:
```
feat(kyc): implement Ballerine API integration
```

**Detailed commit**:
```
feat(kyc): implement Ballerine API integration

Add KYC verification service that integrates with Ballerine API
for identity verification across 240+ countries. Includes:
- REST API wrapper for Ballerine
- Database persistence of KYC status
- Expiry enforcement (auto-block after 2-10 years)
- Error handling and retry logic

closes #42
```

**Bug fix**:
```
fix(auth): prevent JWT token reuse after refresh

Changed token refresh logic to invalidate previous token
immediately. Previously, both old and new tokens were valid,
allowing potential token hijacking.

Security-Fix: https://github.com/org/repo/security/123
```

**Documentation**:
```
docs(contributing): update branch naming conventions
```

---

## ✅ Pull Request Process

### Before Creating a PR

1. **Ensure your branch is up to date**:
   ```bash
   git fetch origin
   git rebase origin/develop
   ```

2. **Run linting and tests locally**:
   ```bash
   npm run lint
   npm run test
   npm run test:coverage
   ```

3. **Ensure 80%+ code coverage** for new code

4. **Update documentation** if behavior changed

### Creating a PR

1. **Push your feature branch**:
   ```bash
   git push origin feature/your-feature
   ```

2. **Create PR on GitHub** with:
   - Clear title: `feat(kyc): implement Ballerine integration`
   - Description of changes
   - Link to related issues: `closes #42`
   - Screenshot if UI changes
   - Test results/coverage report

3. **PR Template** (use this):
   ```markdown
   ## Description
   Brief description of what this PR does.

   ## Related Issues
   Closes #123

   ## Changes Made
   - Change 1
   - Change 2
   - Change 3

   ## How to Test
   1. Step 1
   2. Step 2
   3. Step 3

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Tests added/updated
   - [ ] Documentation updated
   - [ ] No breaking changes
   - [ ] Code coverage 80%+
   ```

### PR Review Requirements

**Before merge, MUST have**:
- ✅ 1+ approving review
- ✅ All tests passing (CI/CD pipeline)
- ✅ No merge conflicts
- ✅ Code coverage ≥80%
- ✅ Branch protection rules satisfied

**Reviewers should check**:
- ✅ Code follows conventions
- ✅ No obvious bugs or security issues
- ✅ Tests are comprehensive
- ✅ Documentation is clear
- ✅ No unnecessary complexity

### Merging

```bash
# Merge via GitHub PR (recommended)
# Don't merge locally

# If merging locally:
git checkout develop
git pull origin develop
git merge feature/your-feature
git push origin develop
```

---

## 🔀 Branch Protection Rules

### On `main` branch

- Require pull request reviews before merging (1+ required)
- Require status checks to pass (CI/CD pipeline)
- Require branches to be up to date before merging
- Require code review from code owners
- Auto-delete head branches on merge
- Require conversations to be resolved before merging

### On `staging` branch

- Require pull request reviews before merging (1+ required)
- Require status checks to pass
- Auto-delete head branches on merge

### On `develop` branch

- No strict protection (to allow quick fixes)
- Recommended but not required: PR reviews
- All contributors can push

---

## 🏃 Development Workflow (Day-to-Day)

### Daily Development

```bash
# Morning: sync with team
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/my-feature

# ... develop feature throughout day ...

# Commit regularly
git add src/kyc-service.ts
git commit -m "feat(kyc): add Ballerine API wrapper"

# Push daily (backup to remote)
git push origin feature/my-feature

# Multiple commits during day is FINE
# We'll squash before merging if needed
```

### End of Week

```bash
# 1. Ensure all work is pushed
git push origin feature/my-feature

# 2. Create Pull Request
# (link to DAILY_ACTIONS_ROADMAP.md task)

# 3. Request review from:
# - Tech Lead (architecture)
# - QA Lead (testing)
# - Related domain expert (compliance/backend)

# 4. Address feedback in follow-up commits
# Don't force push (keeps review history)

# 5. Once approved, merge to develop
```

---

## 🔄 Syncing Your Branch

### Keep your feature branch up to date

```bash
# 1. Fetch latest changes
git fetch origin

# 2. Rebase on develop (preferred for clean history)
git rebase origin/develop

# If conflicts, resolve them:
# - Edit conflicted files
# - git add <resolved-files>
# - git rebase --continue

# OR merge (acceptable alternative)
git merge origin/develop

# 3. Push your updated branch
git push origin feature/my-feature
```

---

## 📋 Code Review Checklist

**As a submitter**, before requesting review:
- [ ] Code follows our style guide (linting passes)
- [ ] TypeScript strict mode compiles without errors
- [ ] Tests added for new functionality
- [ ] Test coverage ≥80%
- [ ] Documentation updated
- [ ] No console.log or debug code left behind
- [ ] No hardcoded secrets or credentials
- [ ] Commit messages are clear and follow conventions
- [ ] PR description explains the "why" not just "what"

**As a reviewer**, check:
- [ ] Code is readable and maintainable
- [ ] Logic is correct and handles edge cases
- [ ] Tests are comprehensive and meaningful
- [ ] No obvious security issues (SQL injection, XXS, etc.)
- [ ] Performance is acceptable (no N+1 queries, etc.)
- [ ] No breaking changes to public APIs
- [ ] Documentation is clear
- [ ] No duplicate code or unnecessary complexity
- [ ] Follows our architectural patterns

---

## 🚫 What NOT to Commit

- `node_modules/` - use .gitignore
- `.env` - use `.env.example` as template
- `dist/` - build artifacts
- Output logs and temporary files
- Database files (PostgreSQL data)
- IDE-specific files (`.vscode/`, `.idea/`)
- Secret keys and credentials
- Large binary files (use Git LFS if needed)

---

## 🔧 Local Development Setup

### First-time setup

```bash
# 1. Clone repository
git clone https://github.com/org/ablk-compliance-tracker.git
cd ablk-compliance-tracker

# 2. Install dependencies
npm install

# 3. Create .env file (copy from .env.example)
cp .env.example .env
# Edit .env with your local values

# 4. Set up pre-commit hooks
npm run setup:hooks

# 5. Start development
npm run dev
```

### Running tests locally

```bash
# All tests
npm test

# Watch mode (re-run on changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Single test file
npm test src/services/kyc.service.test.ts

# Tests matching pattern
npm test -- --testNamePattern="KYC"
```

### Code quality

```bash
# Lint code
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code (Prettier)
npm run format

# Check formatting (without changing)
npm run format:check
```

---

## 📞 Getting Help

- **Technical questions**: Ask in #development Slack channel
- **Architecture decisions**: Discuss with Tech Lead
- **Code review feedback**: Review comments on PR
- **Blocked on something**: Follow escalation process in DAILY_ACTIONS_ROADMAP.md
- **Git issues**: Check Git docs or ask senior developer

---

## 🎓 Resources

- [Ableka Lumina Architecture](Planning%20docs/System%20Architecture/AbekeLumina_RWA_Enterprise_Implementation.md)
- [Implementation Standards](Planning%20docs/Implementation_Standards_Guidelines.md)
- [Daily Actions Roadmap](Planning%20docs/DAILY_ACTIONS_ROADMAP.md)
- [Copilot Development Instructions](.github/copilot-instructions.md)
- [Git Documentation](https://git-scm.com/doc)

---

**Last Updated**: February 26, 2026  
**Version**: 1.0
