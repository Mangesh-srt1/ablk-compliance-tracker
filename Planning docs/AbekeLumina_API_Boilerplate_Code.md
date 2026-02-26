# ComplianceShield API Service - Production Boilerplate Code
## Node.js/TypeScript Implementation Guide

---

## 1. Project Structure

```
src/api/
├── src/
│   ├── config/
│   │   ├── database.ts          # PostgreSQL connection
│   │   ├── redis.ts             # Redis client
│   │   ├── kafka.ts             # Kafka producer/consumer
│   │   ├── logger.ts            # Winston logging
│   │   ├── constants.ts         # App constants
│   │   └── env.ts               # Environment validation
│   │
│   ├── middleware/
│   │   ├── authMiddleware.ts    # JWT validation
│   │   ├── rbacMiddleware.ts    # Role-based access
│   │   ├── errorHandler.ts      # Global error handling
│   │   ├── requestLogger.ts     # Request/response logging
│   │   ├── rateLimiter.ts       # Rate limiting
│   │   └── validation.ts        # Input validation
│   │
│   ├── routes/
│   │   ├── complianceRoutes.ts  # Compliance checks
│   │   ├── oracleRoutes.ts      # Oracle verification
│   │   ├── whitelistRoutes.ts   # Transfer whitelist
│   │   ├── dashboardRoutes.ts   # Metrics & analytics
│   │   ├── filingRoutes.ts      # SAR/CTR filing
│   │   └── healthRoutes.ts      # Health checks
│   │
│   ├── services/
│   │   ├── transferComplianceService.ts
│   │   ├── kycAmlService.ts
│   │   ├── oracleService.ts
│   │   ├── anomalyDetectionService.ts
│   │   ├── sarFilingService.ts
│   │   └── dashboardService.ts
│   │
│   ├── repositories/
│   │   ├── userRepository.ts
│   │   ├── complianceCheckRepository.ts
│   │   ├── rwaAssetRepository.ts
│   │   └── auditLogRepository.ts
│   │
│   ├── types/
│   │   ├── index.ts             # Core types
│   │   ├── errors.ts            # Error definitions
│   │   └── database.ts          # DB entity types
│   │
│   ├── utils/
│   │   ├── jwt.ts               # JWT utilities
│   │   ├── encryption.ts        # Encryption helpers
│   │   ├── hashing.ts           # SHA256/hashing
│   │   └── validators.ts        # Input validators
│   │
│   └── index.ts                 # App entry point
│
├── package.json
├── tsconfig.json
└── Dockerfile
```

---

## 2. Configuration Files

### config/env.ts
```typescript
import dotenv from 'dotenv';
import * as joi from 'joi';

dotenv.config();

const envVarsSchema = joi.object({
  NODE_ENV: joi.string().valid('development', 'production').required(),
  PORT: joi.number().default(3000),
  LOG_LEVEL: joi.string().default('info'),
  
  // Database
  DATABASE_URL: joi.string().required(),
  DB_POOL_MAX: joi.number().default(20),
  
  // Redis
  REDIS_URL: joi.string().required(),
  REDIS_TTL_KYC: joi.number().default(86400),
  
  // JWT
  JWT_SECRET: joi.string().required(),
  JWT_EXPIRY: joi.string().default('900s'),
  
  // External APIs
  BALLERINE_API_KEY: joi.string().required(),
  MARBLE_API_KEY: joi.string().required(),
  CHAINALYSIS_API_KEY: joi.string().required(),
  GROK_API_KEY: joi.string().required(),
  
  // Kafka
  KAFKA_BROKERS: joi.string().default('localhost:9092'),
  KAFKA_GROUP: joi.string().default('compliance-group'),
  
  // Blockchain
  BLOCKCHAIN_TYPE: joi.string().valid('permissioned', 'public').default('permissioned'),
  BESU_RPC_URL: joi.string(),
  ETHEREUM_RPC_URL: joi.string(),
  
  // Feature flags
  ENABLE_ORACLE: joi.boolean().default(true),
  ENABLE_AI_REASONING: joi.boolean().default(true),
}).unknown(true);

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export default {
  nodeEnv: envVars.NODE_ENV,
  port: envVars.PORT,
  logLevel: envVars.LOG_LEVEL,
  database: {
    url: envVars.DATABASE_URL,
    poolMax: envVars.DB_POOL_MAX,
  },
  redis: {
    url: envVars.REDIS_URL,
    ttlKyc: envVars.REDIS_TTL_KYC,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    expiry: envVars.JWT_EXPIRY,
  },
  externalApis: {
    ballerineKey: envVars.BALLERINE_API_KEY,
    marbleKey: envVars.MARBLE_API_KEY,
    chainalysisKey: envVars.CHAINALYSIS_API_KEY,
    grokKey: envVars.GROK_API_KEY,
  },
  kafka: {
    brokers: envVars.KAFKA_BROKERS.split(','),
    group: envVars.KAFKA_GROUP,
  },
  blockchain: {
    type: envVars.BLOCKCHAIN_TYPE,
    besuRpcUrl: envVars.BESU_RPC_URL,
    ethereumRpcUrl: envVars.ETHEREUM_RPC_URL,
  },
};
```

### config/database.ts
```typescript
import { Pool } from 'pg';
import config from './env';
import logger from './logger';

const pool = new Pool({
  connectionString: config.database.url,
  max: config.database.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

export const query = async (text: string, params?: any[]) => {
  const startTime = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - startTime;
    
    if (duration > 100) {
      logger.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}`);
    }
    
    return res;
  } catch (err) {
    logger.error('Database query error', { query: text.substring(0, 100), error: err });
    throw err;
  }
};

export const transaction = async (callback: (client: any) => Promise<any>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export default pool;
```

---

## 3. Middleware

### middleware/authMiddleware.ts
```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env';
import logger from '../config/logger';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; roles: string[] };
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('Invalid JWT token', { error: err });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hasPermission = req.user.roles?.some(
      (role) => ROLE_PERMISSIONS[role]?.includes(permission)
    );

    if (!hasPermission) {
      logger.warn('Permission denied', { userId: req.user.id, permission });
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  compliance_officer: ['compliance:READ', 'compliance:WRITE', 'compliance:ESCALATE'],
  analyst: ['compliance:READ', 'dashboard:READ'],
  client: ['compliance:WRITE', 'whitelist:MANAGE'],
};
```

### middleware/errorHandler.ts
```typescript
import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public data?: any
  ) {
    super(message);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    logger.warn('Application error', { statusCode: err.statusCode, message: err.message });
    return res.status(err.statusCode).json({
      error: err.message,
      data: err.data,
    });
  }

  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
};
```

---

## 4. Core Services

### services/transferComplianceService.ts
```typescript
import { query } from '../config/database';
import redisClient from '../config/redis';
import logger from '../config/logger';
import { KYCAMLService } from './kycAmlService';
import { AnomalyDetectionService } from './anomalyDetectionService';

interface TransferCheckInput {
  from_address: string;
  to_address: string;
  amount: string;
  token_id: string;
  blockchain_type: 'permissioned' | 'public';
  requester_id: string;
}

interface TransferCheckResult {
  check_id: string;
  status: 'APPROVED' | 'REJECTED' | 'ESCALATED';
  risk_score: number;
  decision_reasoning: string;
  kyc_verified: boolean;
  aml_flags: string[];
  sanctions_flagged: boolean;
  whitelist_check: boolean;
  geofence_check: boolean;
}

export class TransferComplianceService {
  async checkTransferCompliance(input: TransferCheckInput): Promise<TransferCheckResult> {
    const startTime = Date.now();
    
    // Check idempotency cache first
    const cacheKey = `transfer:${input.from_address}:${input.to_address}:${input.amount}:${input.token_id}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Run parallel checks
    const [kycResult, amlResult, sanctionsResult, whitelistResult, anomalyResult] = 
      await Promise.all([
        this.checkKYC(input.from_address, input.to_address),
        this.checkAML(input.from_address, input.to_address),
        this.checkSanctions(input.from_address, input.to_address),
        this.checkWhitelist(input.from_address, input.to_address),
        this.checkAnomaly(input.from_address, input.amount),
      ]);

    // Aggregate risk score
    const riskScore = this.calculateRiskScore({
      kycVerified: kycResult.verified,
      amlFlags: amlResult.flags,
      sanctionsFlagged: sanctionsResult.flagged,
      whitelistVerified: whitelistResult.verified,
      anomalyScore: anomalyResult.score,
    });

    // Make decision
    const status = this.makeDecision(riskScore);
    const reasoning = this.generateReasoning({
      kycResult,
      amlResult,
      sanctionsResult,
      whitelistResult,
      anomalyResult,
      status,
    });

    // Store in database
    const checkId = await this.storeComplianceCheck({
      ...input,
      status,
      risk_score: riskScore,
      decision_reasoning: reasoning,
      kyc_verified: kycResult.verified,
      aml_flags: amlResult.flags,
      sanctions_flagged: sanctionsResult.flagged,
      whitelist_check: whitelistResult.verified,
      geofence_check: true, // TODO: implement
    });

    const result: TransferCheckResult = {
      check_id: checkId,
      status,
      risk_score: riskScore,
      decision_reasoning: reasoning,
      kyc_verified: kycResult.verified,
      aml_flags: amlResult.flags,
      sanctions_flagged: sanctionsResult.flagged,
      whitelist_check: whitelistResult.verified,
      geofence_check: true,
    };

    // Cache result
    await redisClient.setex(cacheKey, 300, JSON.stringify(result)); // 5 min cache

    // Publish event to Kafka
    this.publishEvent('compliance-events', {
      type: 'transfer_check_completed',
      check_id: checkId,
      status,
      risk_score: riskScore,
      timestamp: new Date().toISOString(),
    });

    logger.info('Transfer compliance check completed', {
      check_id: checkId,
      status,
      duration: Date.now() - startTime,
    });

    return result;
  }

  private calculateRiskScore(factors: any): number {
    let score = 0;

    if (!factors.kycVerified) score += 30;
    if (factors.amlFlags.length > 0) score += 30;
    if (factors.sanctionsFlagged) score += 20;
    if (!factors.whitelistVerified) score += 10;
    score += factors.anomalyScore * 10; // 0-10 points

    return Math.min(100, score);
  }

  private makeDecision(riskScore: number): 'APPROVED' | 'REJECTED' | 'ESCALATED' {
    if (riskScore < 30) return 'APPROVED';
    if (riskScore >= 70) return 'REJECTED';
    return 'ESCALATED';
  }

  private async checkKYC(from: string, to: string): Promise<any> {
    // Implementation here
    return { verified: true, confidence: 0.95 };
  }

  private async checkAML(from: string, to: string): Promise<any> {
    // Implementation here
    return { flags: [], score: 0 };
  }

  private async checkSanctions(from: string, to: string): Promise<any> {
    // Implementation here
    return { flagged: false };
  }

  private async checkWhitelist(from: string, to: string): Promise<any> {
    // Implementation here
    return { verified: true };
  }

  private async checkAnomaly(address: string, amount: string): Promise<any> {
    // Implementation here
    return { score: 0.1 };
  }

  private generateReasoning(factors: any): string {
    const reasons = [];
    
    if (!factors.kycResult.verified) reasons.push('Incomplete KYC');
    if (factors.amlResult.flags.length > 0) reasons.push(`AML flags: ${factors.amlResult.flags.join(', ')}`);
    if (factors.sanctionsResult.flagged) reasons.push('Sanctions match');
    if (!factors.whitelistResult.verified) reasons.push('Peer not whitelisted');
    
    return reasons.join('. ') || 'All checks passed';
  }

  private async storeComplianceCheck(data: any): Promise<string> {
    const result = await query(
      `INSERT INTO transfer_compliance_checks 
      (from_user_id, to_user_id, token_id, amount, check_status, risk_score, decision_reasoning)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id`,
      [data.from_address, data.to_address, data.token_id, data.amount, data.status, data.risk_score, data.decision_reasoning]
    );
    
    return result.rows[0].id;
  }

  private publishEvent(topic: string, event: any): void {
    // Kafka producer implementation
  }
}
```

---

## 5. Express App Setup

### index.ts
```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import config from './config/env';
import logger from './config/logger';
import { authMiddleware } from './middleware/authMiddleware';
import { errorHandler } from './middleware/errorHandler';
import complianceRoutes from './routes/complianceRoutes';
import oracleRoutes from './routes/oracleRoutes';
import healthRoutes from './routes/healthRoutes';

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS
app.use(compression()); // Gzip
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });
  });
  next();
});

// Routes
app.use('/health', healthRoutes);
app.use('/v1/compliance', authMiddleware, complianceRoutes);
app.use('/v1/oracle', authMiddleware, oracleRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});

export default app;
```

---

## 6. Docker Deployment

### Dockerfile
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build TypeScript
COPY tsconfig.json .
COPY src ./src
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Install dependencies (prod only)
COPY package*.json ./
RUN npm ci --only=production

# Copy built code
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "dist/index.js"]
```

---

## 7. Testing Setup

### __tests__/services/transferComplianceService.test.ts
```typescript
import { TransferComplianceService } from '../../src/services/transferComplianceService';

describe('TransferComplianceService', () => {
  let service: TransferComplianceService;

  beforeEach(() => {
    service = new TransferComplianceService();
  });

  describe('checkTransferCompliance', () => {
    it('should approve low-risk transfers', async () => {
      const result = await service.checkTransferCompliance({
        from_address: '0xabcd1234',
        to_address: '0xefgh5678',
        amount: '1000000000000000000',
        token_id: 'token-123',
        blockchain_type: 'permissioned',
        requester_id: 'user-123',
      });

      expect(result.status).toBe('APPROVED');
      expect(result.risk_score).toBeLessThan(30);
    });

    it('should escalate medium-risk transfers', async () => {
      // Test with partially verified KYC
      const result = await service.checkTransferCompliance({
        from_address: '0xpartially_verified',
        to_address: '0xunknown',
        amount: '5000000000000000000',
        token_id: 'token-123',
        blockchain_type: 'permissioned',
        requester_id: 'user-123',
      });

      expect(result.status).toBe('ESCALATED');
      expect(result.risk_score).toBeGreaterThanOrEqual(30);
      expect(result.risk_score).toBeLessThan(70);
    });

    it('should reject high-risk transfers', async () => {
      // Test with sanctions match
      const result = await service.checkTransferCompliance({
        from_address: '0xsanctioned_address',
        to_address: '0xanother_sanctioned',
        amount: '10000000000000000000',
        token_id: 'token-123',
        blockchain_type: 'permissioned',
        requester_id: 'user-123',
      });

      expect(result.status).toBe('REJECTED');
      expect(result.risk_score).toBeGreaterThanOrEqual(70);
    });
  });
});
```

---

## 8. Package.json

```json
{
  "name": "compliance-shield-api",
  "version": "1.0.0",
  "description": "Enterprise RWA Tokenization Compliance Platform",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "typecheck": "tsc --noEmit",
    "migrate": "knex migrate:latest",
    "migrate:rollback": "knex migrate:rollback",
    "docker:build": "docker build -t compliance-shield-api:1.0.0 .",
    "docker:push": "docker push compliance-shield-api:1.0.0"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.10.0",
    "redis": "^4.6.0",
    "kafkajs": "^2.2.4",
    "jsonwebtoken": "^9.0.0",
    "helmet": "^7.0.0",
    "cors": "^2.8.5",
    "compression": "^1.7.4",
    "dotenv": "^16.0.3",
    "joi": "^17.9.2",
    "winston": "^3.8.2",
    "axios": "^1.4.0",
    "ethers": "^6.4.1",
    "langchain": "^0.0.150"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.17",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.1",
    "jest": "^29.5.0",
    "@types/jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "eslint": "^8.40.0",
    "@typescript-eslint/eslint-plugin": "^5.59.0",
    "@typescript-eslint/parser": "^5.59.0"
  }
}
```

---

**Status**: READY FOR DEVELOPMENT ✅  
**Generated**: February 26, 2026
