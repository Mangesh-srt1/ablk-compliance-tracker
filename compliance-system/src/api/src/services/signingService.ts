/**
 * Signing Service - Handles digital signatures and integrity verification
 * Uses RSA-4096 for asymmetric signing and verification
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
    new winston.transports.File({ filename: 'logs/signing.log' })
  ]
});

export interface SignedData {
  data: string;
  signature: string;
  publicKey: string;
  algorithm: string;
  timestamp: string;
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * SigningService: Manages RSA-4096 digital signatures
 */
export class SigningService {
  private privateKey: string | null = null;
  private publicKey: string | null = null;
  private algorithm: string = 'sha256';

  constructor(keyPair?: { privateKey: string; publicKey: string }) {
    if (keyPair) {
      this.privateKey = keyPair.privateKey;
      this.publicKey = keyPair.publicKey;
      logger.info('SigningService initialized with provided key pair');
    } else {
      // Load from environment or generate new
      const envPrivateKey = process.env.SIGNING_PRIVATE_KEY;
      const envPublicKey = process.env.SIGNING_PUBLIC_KEY;

      if (envPrivateKey && envPublicKey) {
        this.privateKey = envPrivateKey;
        this.publicKey = envPublicKey;
        logger.info('SigningService initialized with environment keys');
      } else {
        // Generate new keypair if not provided
        logger.warn(
          'No SIGNING_PRIVATE_KEY/SIGNING_PUBLIC_KEY environment variables. ' +
          'Generate keys using generateKeyPair()'
        );
      }
    }
  }

  /**
   * Generate a new RSA-4096 key pair
   * Should be called once during initialization
   */
  public static generateKeyPair(): KeyPair {
    try {
      logger.info('Generating RSA-4096 key pair...');

      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      logger.info('Key pair generated successfully');

      return {
        publicKey: publicKey as string,
        privateKey: privateKey as string
      };
    } catch (error) {
      logger.error('Failed to generate key pair:', error);
      throw new Error('Key pair generation failed');
    }
  }

  /**
   * Sign data with private key
   */
  public sign(data: string): SignedData {
    if (!this.privateKey) {
      throw new Error('Private key not available. Cannot sign data.');
    }

    try {
      const signer = crypto.createSign(`RSA-SHA256`);
      signer.update(data);
      signer.end();

      const signature = signer.sign(this.privateKey, 'hex');

      logger.debug('Data signed successfully', {
        dataLength: data.length,
        signatureLength: signature.length
      });

      return {
        data,
        signature,
        publicKey: this.publicKey || '',
        algorithm: `RSA-SHA256`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Signing failed:', error);
      throw new Error('Signing failed');
    }
  }

  /**
   * Sign JSON object
   */
  public signJSON(data: any): SignedData {
    return this.sign(JSON.stringify(data));
  }

  /**
   * Verify signature
   */
  public verify(signedData: SignedData, publicKey?: string): boolean {
    const keyToUse = publicKey || this.publicKey;

    if (!keyToUse) {
      logger.warn('No public key available for verification');
      return false;
    }

    try {
      const verifier = crypto.createVerify(`RSA-SHA256`);
      verifier.update(signedData.data);
      verifier.end();

      const isValid = verifier.verify(keyToUse, signedData.signature, 'hex');

      if (!isValid) {
        logger.warn('Signature verification failed: invalid signature');
      }

      return isValid;
    } catch (error) {
      logger.error('Verification failed:', error);
      return false;
    }
  }

  /**
   * Verify JSON signature
   */
  public verifyJSON(signedData: SignedData, publicKey?: string): boolean {
    try {
      // Verify structure
      JSON.parse(signedData.data);
      return this.verify(signedData, publicKey);
    } catch (error) {
      logger.error('JSON verification failed:', error);
      return false;
    }
  }

  /**
   * Generate HMAC for integrity checking (lightweight alternative to signatures)
   */
  public generateHMAC(data: string, secret: string): string {
    try {
      return crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('hex');
    } catch (error) {
      logger.error('HMAC generation failed:', error);
      throw new Error('HMAC generation failed');
    }
  }

  /**
   * Verify HMAC
   */
  public verifyHMAC(data: string, secret: string, hmac: string): boolean {
    try {
      const computedHmac = this.generateHMAC(data, secret);
      return crypto.timingSafeEqual(
        Buffer.from(computedHmac),
        Buffer.from(hmac)
      );
    } catch (error) {
      logger.error('HMAC verification failed:', error);
      return false;
    }
  }

  /**
   * Get public key (shareable with clients)
   */
  public getPublicKey(): string {
    if (!this.publicKey) {
      throw new Error('Public key not available');
    }
    return this.publicKey;
  }

  /**
   * Set keys (for runtime configuration)
   */
  public setKeys(privateKey: string, publicKey: string): void {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    logger.info('Signing keys updated');
  }

  /**
   * Create a certificate-like structure for compliance decisions
   */
  public createComplianceCertificate(
    decision: {
      entityId: string;
      status: string;
      riskScore: number;
      jurisdiction: string;
    }
  ): SignedData {
    try {
      const certificateData = {
        ...decision,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        issuer: 'Ableka Lumina AI Compliance'
      };

      return this.signJSON(certificateData);
    } catch (error) {
      logger.error('Certificate creation failed:', error);
      throw new Error('Certificate creation failed');
    }
  }

  /**
   * Verify compliance certificate
   */
  public verifyComplianceCertificate(
    signedCertificate: SignedData,
    publicKey?: string
  ): boolean {
    try {
      if (!this.verifyJSON(signedCertificate, publicKey)) {
        return false;
      }

      const cert = JSON.parse(signedCertificate.data);
      const expiresAt = new Date(cert.expiresAt);

      if (expiresAt < new Date()) {
        logger.warn('Certificate has expired');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Certificate verification failed:', error);
      return false;
    }
  }
}

let instance: SigningService | null = null;

export function initializeSigningService(
  keyPair?: { privateKey: string; publicKey: string }
): SigningService {
  if (!instance) {
    instance = new SigningService(keyPair);
  }
  return instance;
}

export function getSigningService(): SigningService {
  if (!instance) {
    instance = new SigningService();
  }
  return instance;
}
