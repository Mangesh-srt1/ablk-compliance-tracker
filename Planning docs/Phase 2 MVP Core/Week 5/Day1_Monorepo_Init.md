# Day 1: Initialize Node.js Monorepo with package.json

## Objective
Set up a Node.js monorepo using npm workspaces for the Ableka Lumina project, including API, UI, and agent packages.

## Steps
1. Create the root directory: `mkdir ableka-lumina && cd ableka-lumina`
2. Initialize npm: `npm init -y`
3. Edit package.json to include workspaces and scripts.

## package.json (Root)
```json
{
  "name": "ableka-lumina",
  "version": "1.0.0",
  "description": "AI-Driven RegTech SaaS Platform",
  "main": "index.js",
  "scripts": {
    "start": "node packages/api/index.js",
    "dev": "concurrently \"npm run dev --workspace=packages/api\" \"npm run dev --workspace=packages/ui\"",
    "test": "npm run test --workspaces",
    "build": "npm run build --workspaces"
  },
  "workspaces": [
    "packages/api",
    "packages/ui",
    "packages/agent"
  ],
  "keywords": ["regtech", "ai", "compliance"],
  "author": "Ableka Team",
  "license": "MIT",
  "devDependencies": {
    "concurrently": "^7.6.0"
  }
}
```

4. Create workspace directories: `mkdir -p packages/api packages/ui packages/agent`
5. Initialize each workspace: `cd packages/api && npm init -y` (repeat for others)
6. Add basic package.json for each workspace.

## packages/api/package.json
```json
{
  "name": "@ableka-lumina/api",
  "version": "1.0.0",
  "description": "API package",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest"
  },
  "dependencies": {},
  "devDependencies": {
    "nodemon": "^2.0.20",
    "jest": "^29.5.0"
  }
}
```

## packages/ui/package.json
```json
{
  "name": "@ableka-lumina/ui",
  "version": "1.0.0",
  "description": "UI package",
  "main": "index.js",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "react-scripts": "5.0.1"
  }
}
```

## packages/agent/package.json
```json
{
  "name": "@ableka-lumina/agent",
  "version": "1.0.0",
  "description": "Agent package",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "jest"
  },
  "dependencies": {},
  "devDependencies": {
    "jest": "^29.5.0"
  }
}
```

## Verification
- Run `npm install` in root to install concurrently.
- Check workspaces: `npm run dev` should start all (after adding scripts).

## Notes
- Monorepo allows shared dependencies and easier management.
- Ready for Day 2 dependency installation.