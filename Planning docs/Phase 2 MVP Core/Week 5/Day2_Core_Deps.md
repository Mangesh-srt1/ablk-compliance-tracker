# Day 2: Install Core Dependencies (axios, zod, express)

## Objective
Install core dependencies for the API package: axios for HTTP requests, zod for schema validation, express for the server.

## Steps
1. Navigate to API package: `cd packages/api`
2. Install dependencies: `npm install axios zod express`
3. Install dev dependencies: `npm install --save-dev @types/express @types/node typescript ts-node`

## Updated packages/api/package.json
```json
{
  "name": "@ableka-lumina/api",
  "version": "1.0.0",
  "description": "API package",
  "main": "index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "axios": "^1.4.0",
    "zod": "^3.21.4",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.4.2",
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1",
    "nodemon": "^2.0.20",
    "jest": "^29.5.0"
  }
}
```

## Basic Express Server (src/index.ts)
```typescript
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Ableka Lumina API');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Zod Example
```typescript
import { z } from 'zod';

const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

app.post('/user', (req, res) => {
  const result = userSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json(result.error);
  }
  res.json({ message: 'User validated', data: result.data });
});
```

## Axios Example
```typescript
import axios from 'axios';

const fetchData = async () => {
  const response = await axios.get('https://api.example.com/data');
  return response.data;
};
```

## Verification
- Run `npm run dev` to start the server.
- Test POST /user with invalid data to see Zod validation.

## Notes
- TypeScript added for better development.
- Ready for LangChain integration in Day 3.