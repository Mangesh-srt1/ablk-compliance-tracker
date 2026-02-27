/**
 * SigningService Unit Tests
 */

import crypto from 'crypto';
import { SigningService, initializeSigningService, getSigningService } from '../signingService';

describe('SigningService', () => {
  let service: SigningService;
  let testKeyPair: any;

  beforeAll(() => {
    // Generate test RSA keys
    const keySync = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048, // Use smaller key size for faster tests
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    testKeyPair = {
      publicKey: keySync.publicKey as any,
      privateKey: keySync.privateKey as any
    };
    
    // Create service instance directly
    service = new SigningService(testKeyPair);
  });

  describe('Key Pair Generation', () => {
    it('should generate RSA-2048 key pair for testing', () => {
      const keyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      expect(keyPair).toHaveProperty('publicKey');
      expect(keyPair).toHaveProperty('privateKey');
      expect(keyPair.privateKey.length).toBeGreaterThan(0);
      expect(keyPair.publicKey.length).toBeGreaterThan(0);
    });

    it('should generate different key pairs each time', () => {
      const keyPair1 = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });

      const keyPair2 = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });

      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
    });
  });

  describe('Digital Signatures', () => {
    it('should sign data with RSA-SHA256', () => {
      const data = 'Compliance decision data';
      const signedData = service.sign(data);

      expect(signedData).toHaveProperty('data');
      expect(signedData).toHaveProperty('signature');
      expect(signedData).toHaveProperty('publicKey');
      expect(signedData).toHaveProperty('algorithm');
      expect(signedData.algorithm).toBe('RSA-SHA256');
    });

    it('should verify signed data with correct public key', () => {
      const data = 'Compliance decision data';
      const signedData = service.sign(data);

      const isValid = service.verify(signedData, signedData.publicKey);
      expect(isValid).toBe(true);
    });

    it('should reject tampered data', () => {
      const data = 'Original compliance decision';
      const signedData = service.sign(data);

      // Tamper with the data
      const tamperedData = {
        ...signedData,
        data: 'Tampered data'
      };

      const isValid = service.verify(tamperedData, signedData.publicKey);
      expect(isValid).toBe(false);
    });

    it('should reject tampered signature', () => {
      const data = 'Compliance decision data';
      const signedData = service.sign(data);

      // Tamper with the signature
      const tamperedSignature = {
        ...signedData,
        signature: 'invalid-signature-data'
      };

      const isValid = service.verify(tamperedSignature, signedData.publicKey);
      expect(isValid).toBe(false);
    });

    it('should handle JSON signing and verification', () => {
      const jsonData = {
        wallet: '0x123456',
        riskScore: 85,
        status: 'ESCALATED'
      };

      const signedJson = service.signJSON(jsonData);
      expect(signedJson).toHaveProperty('data');
      expect(signedJson).toHaveProperty('signature');

      const isValid = service.verifyJSON(signedJson, signedJson.publicKey);
      expect(isValid).toBe(true);
    });
  });

  describe('HMAC Generation and Verification', () => {
    it('should generate HMAC for data', () => {
      const data = 'Compliance data';
      const secret = 'secret-key';
      const hmac = service.generateHMAC(data, secret);

      expect(hmac).toBeDefined();
      expect(hmac.length).toBeGreaterThan(0);
    });

    it('should verify correct HMAC', () => {
      const data = 'Compliance data';
      const secret = 'secret-key';
      const hmac = service.generateHMAC(data, secret);

      const isValid = service.verifyHMAC(data, secret, hmac);
      expect(isValid).toBe(true);
    });

    it('should reject invalid HMAC', () => {
      const data = 'Compliance data';
      const secret = 'secret-key';
      const wrongSecret = 'wrong-secret';
      const hmac = service.generateHMAC(data, secret);

      const isValid = service.verifyHMAC(data, wrongSecret, hmac);
      expect(isValid).toBe(false);
    });

    it('should reject tampered data with HMAC', () => {
      const data = 'Original data';
      const secret = 'secret-key';
      const hmac = service.generateHMAC(data, secret);

      const isValid = service.verifyHMAC('Tampered data', secret, hmac);
      expect(isValid).toBe(false);
    });
  });

  describe('Compliance Certificates', () => {
    it('should have access to signing functionality for certificates', () => {
      // Verify that the service is properly initialized with keys
      const publicKey = service.getPublicKey();
      expect(publicKey).toBeDefined();
      expect(publicKey.length).toBeGreaterThan(0);
    });

    it('should support certificate creation pattern', () => {
      // Test that certificate creation interface is supported
      expect(service.createComplianceCertificate).toBeDefined();
      expect(service.verifyComplianceCertificate).toBeDefined();
    });
  });

  describe('Public Key Management', () => {
    it('should retrieve public key', () => {
      const publicKey = service.getPublicKey();

      expect(publicKey).toBeDefined();
      expect(publicKey.length).toBeGreaterThan(0);
    });

    it('should support runtime key configuration', () => {
      const newKeyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      service.setKeys(newKeyPair);

      const publicKey = service.getPublicKey();
      expect(publicKey).toBe(newKeyPair.publicKey);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getSigningService', () => {
      const service1 = getSigningService();
      const service2 = getSigningService();

      expect(service1).toBe(service2);
    });
  });

  describe('Error Handling', () => {
    it('should have service initialized', () => {
      expect(service).toBeDefined();
    });

    it('should have public key available', () => {
      const publicKey = service.getPublicKey();
      expect(publicKey).toBeDefined();
    });

    it('should support HMAC as fallback for lightweight signing', () => {
      const data = 'Test data';
      const secret = 'test-secret';
      const hmac = service.generateHMAC(data, secret);

      expect(hmac).toBeDefined();
      expect(hmac.length).toBeGreaterThan(0);
    });
  });
});
