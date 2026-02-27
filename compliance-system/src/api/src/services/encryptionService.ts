/**
 * Encryption Service - Handles data encryption/decryption
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/encryption.log' })
  ]
});

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
  algorithm: string;
}

/**
 * EncryptionService: Manages AES-256-GCM encryption/decryption
 */
export class EncryptionService {
  private encryptionKey: Buffer;
  private algorithm: string = 'aes-256-gcm';

  constructor(encryptionKey?: string) {
    if (encryptionKey) {
      // Ensure key is exactly 32 bytes (256 bits)
      const hash = crypto.createHash('sha256');
      hash.update(encryptionKey);
      this.encryptionKey = hash.digest();
    } else {
      const key = process.env.ENCRYPTION_KEY;
      if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable not set');
      }
      const hash = crypto.createHash('sha256');
      hash.update(key);
      this.encryptionKey = hash.digest();
    }
  }

  /**
   * Encrypt sensitive data
   */
  public encrypt(data: string): EncryptedData {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv) as crypto.CipherGCM;

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      logger.debug('Data encrypted successfully', {
        dataLength: data.length,
        encryptedLength: encrypted.length
      });

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.algorithm
      };
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt encrypted data
   */
  public decrypt(encryptedData: EncryptedData): string {
    try {
      const decipher = crypto.createDecipheriv(
        encryptedData.algorithm,
        this.encryptionKey,
        Buffer.from(encryptedData.iv, 'hex')
      ) as crypto.DecipherGCM;

      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      logger.debug('Data decrypted successfully', {
        decryptedLength: decrypted.length
      });

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Encrypt JSON object
   */
  public encryptJSON(data: any): EncryptedData {
    return this.encrypt(JSON.stringify(data));
  }

  /**
   * Decrypt to JSON object
   */
  public decryptJSON(encryptedData: EncryptedData): any {
    try {
      const decrypted = this.decrypt(encryptedData);
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('JSON decryption failed:', error);
      throw new Error('JSON decryption failed');
    }
  }

  /**
   * Hash a password using bcrypt-style salting (with PBKDF2)
   */
  public hashPassword(password: string, iterations: number = 100000): string {
    try {
      const salt = crypto.randomBytes(32);
      const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha256');

      // Format: algorithm$iterations$salt$hash
      const result = `pbkdf2$${iterations}$${salt.toString('hex')}$${hash.toString('hex')}`;

      logger.debug('Password hashed successfully');
      return result;
    } catch (error) {
      logger.error('Password hashing failed:', error);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify a password against a hash
   */
  public verifyPassword(password: string, hash: string): boolean {
    try {
      const [algorithm, iterations, salt, storedHash] = hash.split('$');

      if (algorithm !== 'pbkdf2') {
        logger.warn('Invalid hash algorithm:', { algorithm });
        return false;
      }

      const computedHash = crypto.pbkdf2Sync(
        password,
        Buffer.from(salt, 'hex'),
        parseInt(iterations, 10),
        64,
        'sha256'
      );

      const isMatch = computedHash.toString('hex') === storedHash;

      if (!isMatch) {
        logger.warn('Password verification failed: hash mismatch');
      }

      return isMatch;
    } catch (error) {
      logger.error('Password verification failed:', error);
      return false;
    }
  }

  /**
   * Generate a random API key
   */
  public generateAPIKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash an API key for storage
   */
  public hashAPIKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Verify an API key against its hash
   */
  public verifyAPIKey(apiKey: string, hash: string): boolean {
    const computedHash = this.hashAPIKey(apiKey);
    return crypto.timingSafeEqual(
      Buffer.from(computedHash),
      Buffer.from(hash)
    );
  }
}

let instance: EncryptionService | null = null;

export function initializeEncryptionService(key?: string): EncryptionService {
  if (!instance) {
    instance = new EncryptionService(key);
    logger.info('EncryptionService initialized');
  }
  return instance;
}

export function getEncryptionService(): EncryptionService {
  if (!instance) {
    instance = new EncryptionService();
  }
  return instance;
}
