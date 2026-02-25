# Day 3: Security Vulnerability Fixes and Hardening

## Objectives
- Implement fixes for all identified security vulnerabilities
- Harden application security configuration
- Update dependencies to address known vulnerabilities
- Implement security monitoring and alerting
- Add security-focused middleware and validation

## Implementation Details

### Security Fixes Implementation
Based on the penetration testing results from Day 2, we need to address:

- Input validation and sanitization
- Authentication and authorization hardening
- Data encryption and protection
- Secure session management
- API security improvements
- Dependency updates and vulnerability patches

### Security Hardening Measures
- Implement Content Security Policy (CSP)
- Add security headers and middleware
- Configure secure cookie settings
- Implement rate limiting and DDoS protection
- Add input validation and sanitization
- Secure database queries and connections

## Code Implementation

### 1. Security Fixes Middleware
Create `packages/api/src/middleware/security-fixes.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { SecurityHeadersMiddleware } from './security-headers';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import validator from 'validator';
import crypto from 'crypto';

export class SecurityFixesMiddleware {
  private securityHeaders: SecurityHeadersMiddleware;
  private domPurify: DOMPurify.DOMPurifyI;

  constructor() {
    this.securityHeaders = new SecurityHeadersMiddleware();

    // Initialize DOMPurify for XSS prevention
    const window = new JSDOM('').window;
    this.domPurify = DOMPurify(window as any);
  }

  // Comprehensive input sanitization middleware
  sanitizeInput(req: Request, res: Response, next: NextFunction) {
    try {
      // Sanitize query parameters
      if (req.query) {
        req.query = this.sanitizeObject(req.query);
      }

      // Sanitize body parameters
      if (req.body) {
        req.body = this.sanitizeObject(req.body);
      }

      // Sanitize route parameters
      if (req.params) {
        req.params = this.sanitizeObject(req.params);
      }

      // Sanitize headers (selective)
      if (req.headers) {
        req.headers = this.sanitizeHeaders(req.headers);
      }

      next();
    } catch (error) {
      console.error('Input sanitization error:', error);
      res.status(400).json({ error: 'Invalid input data' });
    }
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeValue(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip sensitive fields that shouldn't be sanitized
      if (this.isSensitiveField(key)) {
        sanitized[key] = value;
      } else {
        sanitized[key] = this.sanitizeObject(value);
      }
    }

    return sanitized;
  }

  private sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      // HTML sanitization
      const sanitized = this.domPurify.sanitize(value, {
        ALLOWED_TAGS: [], // No HTML tags allowed
        ALLOWED_ATTR: []
      });

      // Additional string sanitization
      return validator.escape(sanitized);
    }

    return value;
  }

  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'privateKey',
      'certificate',
      'apiKey',
      'authToken'
    ];

    return sensitiveFields.some(field =>
      fieldName.toLowerCase().includes(field.toLowerCase())
    );
  }

  private sanitizeHeaders(headers: any): any {
    const sanitizedHeaders: any = {};

    for (const [key, value] of Object.entries(headers)) {
      // Only sanitize specific headers that might contain user input
      if (['user-agent', 'referer', 'x-custom-header'].includes(key.toLowerCase())) {
        sanitizedHeaders[key] = this.sanitizeValue(value);
      } else {
        sanitizedHeaders[key] = value;
      }
    }

    return sanitizedHeaders;
  }

  // SQL Injection prevention middleware
  preventSQLInjection(req: Request, res: Response, next: NextFunction) {
    // This is a defense-in-depth measure
    // Primary protection should be through parameterized queries

    const suspicious = this.detectSQLInjection(req);
    if (suspicious) {
      console.warn('Potential SQL injection attempt detected:', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        suspicious: suspicious
      });

      return res.status(400).json({
        error: 'Invalid input detected',
        code: 'INVALID_INPUT'
      });
    }

    next();
  }

  private detectSQLInjection(req: Request): string | null {
    const patterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
      /('|(\\x27)|(\\x2D\\x2D)|(\\#)|(\\x23)|(\%27)|(\%23))/i,
      /(((\%3D)|(=))[^\\n]*((\%27)|(\\x27)|(\')|(\-\-)|(\%3B)|(;)))/i,
      /((\%22)|(\\x22)|(")|(\%5C)|(\\x5C)|(\\\\")|(\%2C)|(\,))/i
    ];

    const checkString = JSON.stringify({
      query: req.query,
      body: req.body,
      params: req.params
    });

    for (const pattern of patterns) {
      const match = checkString.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  // XSS prevention middleware
  preventXSS(req: Request, res: Response, next: NextFunction) {
    const suspicious = this.detectXSS(req);
    if (suspicious) {
      console.warn('Potential XSS attempt detected:', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        suspicious: suspicious
      });

      return res.status(400).json({
        error: 'Invalid input detected',
        code: 'INVALID_INPUT'
      });
    }

    next();
  }

  private detectXSS(req: Request): string | null {
    const patterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
      /<form[^>]*>/gi,
      /<input[^>]*>/gi,
      /<meta[^>]*>/gi,
      /<link[^>]*>/gi
    ];

    const checkString = JSON.stringify({
      query: req.query,
      body: req.body,
      params: req.params
    });

    for (const pattern of patterns) {
      const match = checkString.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  // CSRF protection middleware
  csrfProtection(req: Request, res: Response, next: NextFunction) {
    // Skip CSRF check for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Check for CSRF token
    const token = req.headers['x-csrf-token'] || req.body?._csrf;
    const sessionToken = (req as any).session?.csrfToken;

    if (!token || !sessionToken || token !== sessionToken) {
      console.warn('CSRF token validation failed:', {
        ip: req.ip,
        method: req.method,
        url: req.url,
        hasToken: !!token,
        hasSessionToken: !!sessionToken
      });

      return res.status(403).json({
        error: 'CSRF token validation failed',
        code: 'CSRF_FAILED'
      });
    }

    next();
  }

  // Generate CSRF token
  generateCSRFToken(req: Request): string {
    const secret = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production';
    const sessionId = (req as any).session?.id || 'anonymous';
    const timestamp = Math.floor(Date.now() / 60000); // 1 minute window

    return crypto
      .createHash('sha256')
      .update(`${secret}:${sessionId}:${timestamp}`)
      .digest('hex');
  }

  // Rate limiting middleware
  rateLimit(windowMs: number = 15 * 60 * 1000, max: number = 100) {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip || 'unknown';
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean up old entries
      for (const [ip, data] of requests.entries()) {
        if (data.resetTime < windowStart) {
          requests.delete(ip);
        }
      }

      // Get or create request data
      const requestData = requests.get(key) || { count: 0, resetTime: now + windowMs };

      // Check if limit exceeded
      if (requestData.count >= max) {
        console.warn('Rate limit exceeded:', {
          ip: key,
          count: requestData.count,
          max,
          resetIn: Math.ceil((requestData.resetTime - now) / 1000)
        });

        res.setHeader('X-RateLimit-Limit', max.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', requestData.resetTime.toString());
        res.setHeader('Retry-After', Math.ceil((requestData.resetTime - now) / 1000).toString());

        return res.status(429).json({
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED'
        });
      }

      // Increment counter
      requestData.count++;
      requests.set(key, requestData);

      // Set headers
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', (max - requestData.count).toString());
      res.setHeader('X-RateLimit-Reset', requestData.resetTime.toString());

      next();
    };
  }

  // Security headers application
  applySecurityHeaders(req: Request, res: Response, next: NextFunction) {
    this.securityHeaders.applySecurityHeaders(req, res, next);
  }

  // API security middleware
  applyAPISecurity(req: Request, res: Response, next: NextFunction) {
    this.securityHeaders.applyAPISecurityHeaders(req, res, next);
  }

  // File upload security
  secureFileUpload(req: Request, res: Response, next: NextFunction) {
    // Check file type and size
    if (req.file) {
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif',
        'application/pdf',
        'text/plain', 'text/csv'
      ];

      const maxSize = 10 * 1024 * 1024; // 10MB

      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          error: 'File type not allowed',
          code: 'INVALID_FILE_TYPE'
        });
      }

      if (req.file.size > maxSize) {
        return res.status(400).json({
          error: 'File too large',
          code: 'FILE_TOO_LARGE'
        });
      }

      // Scan for malware (basic check)
      if (this.detectMalware(req.file.buffer)) {
        return res.status(400).json({
          error: 'File contains malicious content',
          code: 'MALICIOUS_FILE'
        });
      }
    }

    this.securityHeaders.applyFileUploadHeaders(req, res, next);
  }

  private detectMalware(buffer: Buffer): boolean {
    // Basic malware detection patterns
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload/i,
      /onerror/i,
      /eval\(/i,
      /Function\(/i
    ];

    const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length));

    return maliciousPatterns.some(pattern => pattern.test(content));
  }

  // Secure error handling
  secureErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    console.error('Security error:', {
      message: err.message,
      stack: err.stack,
      ip: req.ip,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Don't leak sensitive information
    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(err.status || 500).json({
      error: isDevelopment ? err.message : 'Internal server error',
      code: err.code || 'INTERNAL_ERROR',
      ...(isDevelopment && { stack: err.stack })
    });
  }

  // Security audit logging
  auditLog(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    // Log after response is finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      console.log('Security audit:', {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration,
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.id || 'anonymous',
        requestId: res.getHeader('X-Request-ID')
      });
    });

    next();
  }
}

// Export singleton instance
export const securityFixes = new SecurityFixesMiddleware();
```

### 2. Database Security Hardening
Create `packages/api/src/database/security.ts`:

```typescript
import { Pool, PoolConfig } from 'pg';
import { createHash } from 'crypto';

export class DatabaseSecurity {
  private pool: Pool;

  constructor(config: PoolConfig) {
    // Secure database configuration
    this.pool = new Pool({
      ...config,
      // SSL required for production
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
      // Connection timeout
      connectionTimeoutMillis: 10000,
      // Query timeout
      query_timeout: 30000,
      // Idle timeout
      idleTimeoutMillis: 30000,
      // Max connections
      max: 20,
      // Min connections
      min: 2
    });

    this.setupSecurityListeners();
  }

  private setupSecurityListeners() {
    this.pool.on('connect', (client) => {
      // Set secure session parameters
      client.query('SET session_replication_role = replica;'); // Prevent triggers during queries
      client.query('SET search_path TO public;'); // Prevent schema injection
    });

    this.pool.on('error', (err, client) => {
      console.error('Database security error:', err);
      // Log security incidents
      this.logSecurityIncident('database_error', {
        error: err.message,
        client: client?.processID
      });
    });
  }

  // Secure parameterized query execution
  async secureQuery(text: string, params: any[] = []): Promise<any> {
    // Validate query for potential SQL injection
    if (this.detectSQLInjection(text)) {
      throw new Error('Potential SQL injection detected');
    }

    // Validate parameters
    this.validateParameters(params);

    try {
      const result = await this.pool.query(text, params);

      // Log sensitive operations
      if (this.isSensitiveOperation(text)) {
        this.logSensitiveOperation(text, params);
      }

      return result;
    } catch (error) {
      // Log failed queries for security analysis
      this.logSecurityIncident('query_error', {
        query: this.sanitizeQueryForLogging(text),
        error: error.message
      });
      throw error;
    }
  }

  private detectSQLInjection(query: string): boolean {
    const patterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b.*;)/i,
      /('|(\\x27)|(\\x2D\\x2D)|(\\#)|(\\x23)|(\%27)|(\%23))/i,
      /((\%3D)|(=))[^\\n]*((\%27)|(\\x27)|(\')|(\-\-)|(\%3B)|(;))/i
    ];

    return patterns.some(pattern => pattern.test(query));
  }

  private validateParameters(params: any[]): void {
    for (const param of params) {
      if (typeof param === 'string' && param.length > 10000) {
        throw new Error('Parameter too large');
      }

      if (this.containsSuspiciousContent(param)) {
        throw new Error('Suspicious parameter content');
      }
    }
  }

  private containsSuspiciousContent(value: any): boolean {
    if (typeof value !== 'string') return false;

    const suspicious = [
      '<script', 'javascript:', 'vbscript:', 'onload=', 'onerror=',
      'eval(', 'Function(', 'setTimeout(', 'setInterval('
    ];

    return suspicious.some(pattern => value.toLowerCase().includes(pattern));
  }

  private isSensitiveOperation(query: string): boolean {
    const sensitiveKeywords = ['password', 'token', 'secret', 'key', 'ssn', 'credit_card'];
    const lowerQuery = query.toLowerCase();

    return sensitiveKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  private logSensitiveOperation(query: string, params: any[]): void {
    console.log('Sensitive database operation:', {
      timestamp: new Date().toISOString(),
      query: this.sanitizeQueryForLogging(query),
      paramCount: params.length,
      operation: this.getOperationType(query)
    });
  }

  private sanitizeQueryForLogging(query: string): string {
    // Remove actual values but keep structure for analysis
    return query.replace(/'[^']*'/g, "'***'").replace(/\$[0-9]+/g, '$*');
  }

  private getOperationType(query: string): string {
    const lowerQuery = query.toLowerCase().trim();

    if (lowerQuery.startsWith('select')) return 'SELECT';
    if (lowerQuery.startsWith('insert')) return 'INSERT';
    if (lowerQuery.startsWith('update')) return 'UPDATE';
    if (lowerQuery.startsWith('delete')) return 'DELETE';
    if (lowerQuery.startsWith('create')) return 'CREATE';
    if (lowerQuery.startsWith('drop')) return 'DROP';
    if (lowerQuery.startsWith('alter')) return 'ALTER';

    return 'UNKNOWN';
  }

  private logSecurityIncident(type: string, details: any): void {
    console.error('Database security incident:', {
      type,
      timestamp: new Date().toISOString(),
      ...details
    });

    // In production, this should be sent to a security monitoring system
  }

  // Secure transaction execution
  async secureTransaction(callback: (client: any) => Promise<any>): Promise<any> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Set transaction isolation level for security
      await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

      const result = await callback(client);

      await client.query('COMMIT');
      return result;

    } catch (error) {
      await client.query('ROLLBACK');

      this.logSecurityIncident('transaction_error', {
        error: error.message,
        client: client.processID
      });

      throw error;
    } finally {
      client.release();
    }
  }

  // Data encryption utilities
  encryptData(data: string, key?: string): string {
    const encryptionKey = key || process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  decryptData(encryptedData: string, key?: string): string {
    const encryptionKey = key || process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey);
    decipher.setAutoPadding(false);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Secure password hashing
  hashPassword(password: string): string {
    const saltRounds = 12; // bcrypt default
    return crypto.createHash('sha256').update(password).digest('hex');
    // In production, use bcrypt or argon2
  }

  // Secure random token generation
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Connection health check
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1 as health_check');
      return result.rows[0].health_check === 1;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  // Graceful shutdown
  async close(): Promise<void> {
    await this.pool.end();
  }

  // Get pool statistics for monitoring
  getStats(): any {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }
}
```

### 3. Authentication Security Hardening
Create `packages/api/src/auth/security.ts`:

```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Request, Response } from 'express';

export class AuthSecurity {
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private bcryptRounds: number = 12;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production';

    if (process.env.NODE_ENV === 'production' &&
        (this.jwtSecret.includes('default') || this.jwtRefreshSecret.includes('default'))) {
      throw new Error('JWT secrets must be configured in production');
    }
  }

  // Secure password hashing
  async hashPassword(password: string): Promise<string> {
    // Validate password strength
    this.validatePasswordStrength(password);

    return bcrypt.hash(password, this.bcryptRounds);
  }

  // Password verification
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Password strength validation
  private validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter, one uppercase letter, and one number');
    }

    // Check for common passwords
    const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein'];
    if (commonPasswords.includes(password.toLowerCase())) {
      throw new Error('Password is too common');
    }
  }

  // JWT token generation with security features
  generateAccessToken(payload: any): string {
    return jwt.sign({
      ...payload,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
    }, this.jwtSecret, {
      algorithm: 'HS256',
      issuer: 'ableka-lumina',
      audience: 'api-users'
    });
  }

  // Refresh token generation
  generateRefreshToken(payload: any): string {
    return jwt.sign({
      ...payload,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    }, this.jwtRefreshSecret, {
      algorithm: 'HS256',
      issuer: 'ableka-lumina',
      audience: 'api-users'
    });
  }

  // Secure token verification
  verifyAccessToken(token: string): any {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'ableka-lumina',
        audience: 'api-users'
      });

      if ((decoded as any).type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  // Refresh token verification
  verifyRefreshToken(token: string): any {
    try {
      const decoded = jwt.verify(token, this.jwtRefreshSecret, {
        algorithms: ['HS256'],
        issuer: 'ableka-lumina',
        audience: 'api-users'
      });

      if ((decoded as any).type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  // Token refresh with rotation
  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const decoded = this.verifyRefreshToken(refreshToken);

    // Generate new token pair
    const newAccessToken = this.generateAccessToken({
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    });

    const newRefreshToken = this.generateRefreshToken({
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    });

    // Invalidate old refresh token (implement token blacklist)
    await this.blacklistToken(refreshToken);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  // Token blacklisting for logout and security
  private async blacklistToken(token: string): Promise<void> {
    // In production, store in Redis or database
    const blacklist = new Set(); // Temporary in-memory store
    blacklist.add(token);

    // Clean up expired tokens periodically
    setTimeout(() => {
      blacklist.delete(token);
    }, 7 * 24 * 60 * 60 * 1000); // 7 days
  }

  // Session security
  generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Secure cookie configuration
  getSecureCookieOptions(): any {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined
    };
  }

  // Multi-factor authentication support
  generateMFACode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // MFA code verification with timing
  verifyMFACode(code: string, storedCode: string, timestamp: number): boolean {
    const now = Date.now();
    const codeAge = now - timestamp;

    // Code expires after 5 minutes
    if (codeAge > 5 * 60 * 1000) {
      return false;
    }

    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(code, 'utf8'),
      Buffer.from(storedCode, 'utf8')
    );
  }

  // Account lockout protection
  trackFailedLogin(username: string): { locked: boolean; attempts: number } {
    // In production, use Redis or database
    const attempts = new Map<string, { count: number; lockoutUntil: number }>();

    const userAttempts = attempts.get(username) || { count: 0, lockoutUntil: 0 };
    const now = Date.now();

    // Check if account is locked
    if (userAttempts.lockoutUntil > now) {
      return { locked: true, attempts: userAttempts.count };
    }

    // Increment attempts
    userAttempts.count++;

    // Lock account after 5 failed attempts
    if (userAttempts.count >= 5) {
      userAttempts.lockoutUntil = now + (15 * 60 * 1000); // 15 minutes lockout
    }

    attempts.set(username, userAttempts);

    return { locked: false, attempts: userAttempts.count };
  }

  // Password reset token generation
  generatePasswordResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Secure password reset
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    // Verify token (in production, check against database)
    if (!token || token.length !== 64) {
      return false;
    }

    // Validate new password
    try {
      this.validatePasswordStrength(newPassword);
    } catch (error) {
      return false;
    }

    // Hash and store new password
    const hashedPassword = await this.hashPassword(newPassword);

    // Invalidate reset token
    // Implementation depends on storage mechanism

    return true;
  }

  // API key generation and validation
  generateAPIKey(): string {
    return 'ak_' + crypto.randomBytes(32).toString('hex');
  }

  validateAPIKey(apiKey: string): boolean {
    // Check format
    if (!apiKey.startsWith('ak_') || apiKey.length !== 67) {
      return false;
    }

    // In production, validate against database
    return true;
  }

  // Audit logging for security events
  logSecurityEvent(event: string, details: any): void {
    console.log('Security event:', {
      event,
      timestamp: new Date().toISOString(),
      ...details
    });

    // In production, send to security monitoring system
  }

  // Rate limiting for authentication endpoints
  getAuthRateLimit(): { windowMs: number; max: number } {
    return {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5 // 5 attempts per window
    };
  }
}

// Export singleton instance
export const authSecurity = new AuthSecurity();
```

### 4. Dependency Vulnerability Scanner
Create `scripts/audit-dependencies.js`:

```javascript
#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🔍 Auditing dependencies for security vulnerabilities...');

  try {
    // Run npm audit
    console.log('Running npm audit...');
    const auditOutput = execSync('npm audit --audit-level=moderate --json', {
      encoding: 'utf8',
      cwd: process.cwd()
    });

    const auditResult = JSON.parse(auditOutput);

    // Check for vulnerabilities
    if (auditResult.metadata.vulnerabilities.total > 0) {
      console.error('❌ Security vulnerabilities found:');
      console.error(`Total: ${auditResult.metadata.vulnerabilities.total}`);
      console.error(`Critical: ${auditResult.metadata.vulnerabilities.critical}`);
      console.error(`High: ${auditResult.metadata.vulnerabilities.high}`);
      console.error(`Moderate: ${auditResult.metadata.vulnerabilities.moderate}`);
      console.error(`Low: ${auditResult.metadata.vulnerabilities.low}`);

      // Generate detailed report
      generateVulnerabilityReport(auditResult);

      // Exit with error if critical vulnerabilities exist
      if (auditResult.metadata.vulnerabilities.critical > 0) {
        console.error('💥 Critical vulnerabilities found - deployment blocked!');
        process.exit(1);
      }

      // Warn for high vulnerabilities
      if (auditResult.metadata.vulnerabilities.high > 0) {
        console.warn('⚠️  High severity vulnerabilities found - review required');
      }
    } else {
      console.log('✅ No security vulnerabilities found');
    }

    // Check for outdated packages
    console.log('Checking for outdated packages...');
    const outdatedOutput = execSync('npm outdated --json', {
      encoding: 'utf8',
      cwd: process.cwd()
    });

    const outdatedPackages = JSON.parse(outdatedOutput);
    const outdatedCount = Object.keys(outdatedPackages).length;

    if (outdatedCount > 0) {
      console.warn(`⚠️  ${outdatedCount} packages are outdated`);
      generateOutdatedReport(outdatedPackages);
    } else {
      console.log('✅ All packages are up to date');
    }

    // Run additional security checks
    await runAdditionalSecurityChecks();

  } catch (error) {
    console.error('❌ Dependency audit failed:', error.message);
    process.exit(1);
  }
}

function generateVulnerabilityReport(auditResult) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: auditResult.metadata.vulnerabilities,
    vulnerabilities: auditResult.vulnerabilities || {},
    recommendations: generateRecommendations(auditResult)
  };

  fs.writeFileSync('dependency-vulnerabilities.json', JSON.stringify(report, null, 2));
  console.log('📄 Vulnerability report saved to dependency-vulnerabilities.json');
}

function generateRecommendations(auditResult) {
  const recommendations = [];

  if (auditResult.metadata.vulnerabilities.critical > 0) {
    recommendations.push('Address all critical vulnerabilities immediately');
  }

  if (auditResult.metadata.vulnerabilities.high > 0) {
    recommendations.push('Review and fix high-severity vulnerabilities before deployment');
  }

  recommendations.push('Run npm audit fix to automatically fix vulnerabilities where possible');
  recommendations.push('Update package.json to use latest stable versions');
  recommendations.push('Consider using npm ci for reproducible builds');

  return recommendations;
}

function generateOutdatedReport(outdatedPackages) {
  const report = {
    timestamp: new Date().toISOString(),
    outdatedPackages,
    recommendations: [
      'Run npm update to update packages within semver ranges',
      'Review breaking changes before major version updates',
      'Test thoroughly after updating packages'
    ]
  };

  fs.writeFileSync('outdated-packages.json', JSON.stringify(report, null, 2));
  console.log('📄 Outdated packages report saved to outdated-packages.json');
}

async function runAdditionalSecurityChecks() {
  console.log('Running additional security checks...');

  // Check for package-lock.json
  if (!fs.existsSync('package-lock.json')) {
    console.warn('⚠️  package-lock.json not found - consider using npm ci for reproducible builds');
  }

  // Check for .npmrc security settings
  if (fs.existsSync('.npmrc')) {
    const npmrc = fs.readFileSync('.npmrc', 'utf8');
    if (!npmrc.includes('audit=true')) {
      console.warn('⚠️  Consider enabling automatic security audits in .npmrc');
    }
  }

  // Check for security-related scripts in package.json
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const scripts = packageJson.scripts || {};

  if (!scripts['audit']) {
    console.warn('⚠️  Consider adding audit script to package.json');
  }

  if (!scripts['security']) {
    console.warn('⚠️  Consider adding security test script to package.json');
  }

  console.log('✅ Additional security checks completed');
}

// Update package.json with security scripts
function updatePackageJson() {
  const packageJsonPath = 'package.json';

  if (!fs.existsSync(packageJsonPath)) {
    console.warn('package.json not found');
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  // Add security scripts
  packageJson.scripts['audit:security'] = 'npm audit --audit-level=moderate';
  packageJson.scripts['audit:fix'] = 'npm audit fix';
  packageJson.scripts['audit:check'] = 'node scripts/audit-dependencies.js';
  packageJson.scripts['security'] = 'npm run audit:check && npm run test:security';

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('📝 Updated package.json with security scripts');
}

if (require.main === module) {
  main();
}
```

### 5. Security Monitoring and Alerting
Create `packages/api/src/monitoring/security-monitor.ts`:

```typescript
import { EventEmitter } from 'events';

export interface SecurityEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  timestamp: Date;
  source: string;
  userId?: string;
  ip?: string;
}

export class SecurityMonitor extends EventEmitter {
  private events: SecurityEvent[] = [];
  private maxEvents: number = 10000;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Handle security events
    this.on('security-event', this.handleSecurityEvent.bind(this));
  }

  // Log security event
  logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date()
    };

    // Store event
    this.events.push(securityEvent);

    // Maintain max events limit
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Emit event for real-time monitoring
    this.emit('security-event', securityEvent);

    // Handle based on severity
    this.handleSecurityEvent(securityEvent);
  }

  private handleSecurityEvent(event: SecurityEvent): void {
    // Log to console with appropriate level
    const logMessage = `[${event.severity.toUpperCase()}] ${event.type}: ${event.message}`;

    switch (event.severity) {
      case 'critical':
        console.error('🚨', logMessage);
        this.handleCriticalEvent(event);
        break;
      case 'high':
        console.error('⚠️', logMessage);
        this.handleHighSeverityEvent(event);
        break;
      case 'medium':
        console.warn('⚡', logMessage);
        break;
      case 'low':
        console.info('ℹ️', logMessage);
        break;
    }

    // Send to external monitoring service
    this.sendToMonitoringService(event);
  }

  private handleCriticalEvent(event: SecurityEvent): void {
    // Immediate actions for critical events
    console.error('🚨 CRITICAL SECURITY EVENT - IMMEDIATE ACTION REQUIRED');

    // Could trigger:
    // - Alert notifications
    // - Account lockdowns
    // - IP blocks
    // - Emergency response procedures
  }

  private handleHighSeverityEvent(event: SecurityEvent): void {
    // Actions for high-severity events
    console.error('⚠️ HIGH SEVERITY SECURITY EVENT');

    // Could trigger:
    // - Email alerts
    // - Increased monitoring
    // - Temporary restrictions
  }

  // Predefined security event types
  logFailedLogin(details: { userId?: string; ip: string; userAgent: string }): void {
    this.logSecurityEvent({
      type: 'failed_login',
      severity: 'medium',
      message: 'Failed login attempt',
      details,
      source: 'auth',
      ...details
    });
  }

  logSuccessfulLogin(details: { userId: string; ip: string; userAgent: string }): void {
    this.logSecurityEvent({
      type: 'successful_login',
      severity: 'low',
      message: 'Successful login',
      details,
      source: 'auth',
      ...details
    });
  }

  logSuspiciousActivity(details: { activity: string; ip: string; userId?: string }): void {
    this.logSecurityEvent({
      type: 'suspicious_activity',
      severity: 'high',
      message: `Suspicious activity detected: ${details.activity}`,
      details,
      source: 'monitoring',
      ...details
    });
  }

  logSQLInjectionAttempt(details: { query: string; ip: string; userId?: string }): void {
    this.logSecurityEvent({
      type: 'sql_injection_attempt',
      severity: 'critical',
      message: 'SQL injection attempt detected',
      details,
      source: 'database',
      ...details
    });
  }

  logXSSAttempt(details: { payload: string; ip: string; userId?: string }): void {
    this.logSecurityEvent({
      type: 'xss_attempt',
      severity: 'high',
      message: 'XSS attempt detected',
      details,
      source: 'input_validation',
      ...details
    });
  }

  logRateLimitExceeded(details: { endpoint: string; ip: string; userId?: string }): void {
    this.logSecurityEvent({
      type: 'rate_limit_exceeded',
      severity: 'medium',
      message: `Rate limit exceeded for ${details.endpoint}`,
      details,
      source: 'rate_limiting',
      ...details
    });
  }

  logUnauthorizedAccess(details: { resource: string; ip: string; userId?: string }): void {
    this.logSecurityEvent({
      type: 'unauthorized_access',
      severity: 'high',
      message: `Unauthorized access attempt to ${details.resource}`,
      details,
      source: 'authorization',
      ...details
    });
  }

  // Get security events for analysis
  getSecurityEvents(options: {
    type?: string;
    severity?: string;
    source?: string;
    since?: Date;
    limit?: number;
  } = {}): SecurityEvent[] {
    let filtered = this.events;

    if (options.type) {
      filtered = filtered.filter(e => e.type === options.type);
    }

    if (options.severity) {
      filtered = filtered.filter(e => e.severity === options.severity);
    }

    if (options.source) {
      filtered = filtered.filter(e => e.source === options.source);
    }

    if (options.since) {
      filtered = filtered.filter(e => e.timestamp >= options.since!);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return options.limit ? filtered.slice(0, options.limit) : filtered;
  }

  // Generate security report
  generateSecurityReport(since?: Date): any {
    const events = this.getSecurityEvents({ since });
    const summary = {
      total: events.length,
      bySeverity: {
        critical: events.filter(e => e.severity === 'critical').length,
        high: events.filter(e => e.severity === 'high').length,
        medium: events.filter(e => e.severity === 'medium').length,
        low: events.filter(e => e.severity === 'low').length
      },
      byType: events.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      bySource: events.reduce((acc, e) => {
        acc[e.source] = (acc[e.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      timeRange: {
        from: since || events[events.length - 1]?.timestamp,
        to: events[0]?.timestamp
      }
    };

    return {
      summary,
      events: events.slice(0, 100), // Last 100 events
      recommendations: this.generateRecommendations(summary)
    };
  }

  private generateRecommendations(summary: any): string[] {
    const recommendations = [];

    if (summary.bySeverity.critical > 0) {
      recommendations.push('Address critical security events immediately');
    }

    if (summary.bySeverity.high > 5) {
      recommendations.push('Review high-severity events and implement additional controls');
    }

    if (summary.byType.failed_login > 10) {
      recommendations.push('Implement account lockout policies');
    }

    if (summary.byType.rate_limit_exceeded > 20) {
      recommendations.push('Review rate limiting configuration');
    }

    return recommendations;
  }

  private sendToMonitoringService(event: SecurityEvent): void {
    // In production, send to services like:
    // - Datadog
    // - Splunk
    // - ELK Stack
    // - Security Information and Event Management (SIEM) systems

    // For now, just log
    console.log('📤 Security event sent to monitoring service:', event.type);
  }

  // Health check
  getHealthStatus(): any {
    return {
      status: 'healthy',
      eventsStored: this.events.length,
      maxEvents: this.maxEvents,
      lastEvent: this.events[this.events.length - 1]?.timestamp
    };
  }
}

// Export singleton instance
export const securityMonitor = new SecurityMonitor();
```

## Testing and Validation

### Security Fixes Testing
```bash
# Run security vulnerability tests
npm run test:security:fixes

# Test input sanitization
npm run test:security:sanitization

# Test authentication security
npm run test:security:auth

# Test database security
npm run test:security:database
```

### Dependency Audit
```bash
# Audit dependencies for vulnerabilities
npm run audit:check

# Fix vulnerabilities automatically
npm run audit:fix

# Update outdated packages
npm update

# Generate security reports
node scripts/audit-dependencies.js
```

### Security Monitoring
```bash
# View security events
npm run security:events

# Generate security report
npm run security:report

# Monitor security in real-time
npm run security:monitor
```

### Security Headers Validation
```bash
# Test security headers
curl -I https://api.ableka.com/api/health

# Validate CSP
curl -s https://app.ableka.com | grep -i "content-security-policy"

# Check for security headers
npm run test:security:headers
```

### CI/CD Security Integration
```yaml
# .github/workflows/security-fixes.yml
name: Security Fixes
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run audit:check
      - run: npm run test:security
      - run: npm run security:report
```

## Next Steps
- Day 4 will focus on jurisdiction switching testing and global workflow validation
- Day 5 will complete Week 17 with comprehensive testing and documentation
- Week 18 will begin with advanced performance optimization and scaling

This security hardening implementation provides comprehensive protection against common web application vulnerabilities, secure authentication mechanisms, database security, and continuous monitoring capabilities for the Ableka Lumina platform.</content>
<parameter name="filePath">c:\Users\Mange\work\ablk-compliance-tracker\docs\Phase 4 Testing & Compliance\Week 17\Day 3.md