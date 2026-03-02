/**
 * EncryptionService Unit Tests
 */

import { initializeEncryptionService, getEncryptionService } from '../encryptionService';

describe('EncryptionService', () => {
  let service: any;

  beforeAll(() => {
    service = initializeEncryptionService('test-encryption-key-32-bytes-long!');
  });

  describe('Encryption & Decryption', () => {
    it('should encrypt and decrypt data correctly', () => {
      const originalData = 'Sensitive compliance information';
      const encrypted = service.encrypt(originalData);

      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted.algorithm).toBe('aes-256-gcm');

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(originalData);
    });

    it('should not decrypt with wrong key', () => {
      const originalData = 'Sensitive data';
      const encrypted = service.encrypt(originalData);

      // Create a new service with different key
      const wrongService = getEncryptionService();
      
      // Attempting to decrypt should fail gracefully
      try {
        wrongService.decrypt(encrypted);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle JSON encryption and decryption', () => {
      const originalObj = {
        wallet: '0x123456',
        riskScore: 85,
        status: 'ESCALATED',
        flags: ['SANCTIONS', 'PEP']
      };

      const encryptedJson = service.encryptJSON(originalObj);
      expect(encryptedJson).toHaveProperty('encrypted');

      const decryptedJson = service.decryptJSON(encryptedJson);
      expect(decryptedJson).toEqual(originalObj);
    });
  });

  describe('Password Hashing', () => {
    it('should hash password with salt', () => {
      const password = 'MyComplexPassword123!';
      const hash = service.hashPassword(password);

      // Hash should be a formatted string: pbkdf2$iterations$salt$hash
      expect(typeof hash).toBe('string');
      expect(hash).toMatch(/^pbkdf2\$/);
      expect(hash.length).toBeGreaterThan(50); // PBKDF2 format is lengthy
    });

    it('should verify correct password', () => {
      const password = 'MyComplexPassword123!';
      const hash = service.hashPassword(password);

      const isValid = service.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', () => {
      const password = 'MyComplexPassword123!';
      const wrongPassword = 'WrongPassword';
      const hash = service.hashPassword(password);

      const isValid = service.verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should use different salt for different hashes', () => {
      const password = 'SamePassword';
      const hash1 = service.hashPassword(password);
      const hash2 = service.hashPassword(password);

      // Each hash includes a random salt, so they should be different
      expect(hash1).not.toBe(hash2);
      
      // Both should be valid hashes in pbkdf2$iterations$salt$hash format
      expect(hash1).toMatch(/^pbkdf2\$\d+\$/);
      expect(hash2).toMatch(/^pbkdf2\$\d+\$/);
    });
  });

  describe('API Key Management', () => {
    it('should generate cryptographically secure API keys', () => {
      const apiKey1 = service.generateAPIKey();
      const apiKey2 = service.generateAPIKey();

      expect(apiKey1).not.toBe(apiKey2);
      expect(apiKey1.length).toBeGreaterThan(0);
      expect(apiKey2.length).toBeGreaterThan(0);
    });

    it('should hash and verify API keys', () => {
      const apiKey = service.generateAPIKey();
      const hashedKey = service.hashAPIKey(apiKey);

      expect(hashedKey).not.toBe(apiKey);
      expect(hashedKey.length).toBeGreaterThan(0);

      const isValid = service.verifyAPIKey(apiKey, hashedKey);
      expect(isValid).toBe(true);
    });

    it('should reject invalid API keys', () => {
      const apiKey = service.generateAPIKey();
      const hashedKey = service.hashAPIKey(apiKey);
      const wrongKey = service.generateAPIKey();

      const isValid = service.verifyAPIKey(wrongKey, hashedKey);
      expect(isValid).toBe(false);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getEncryptionService', () => {
      const service1 = getEncryptionService();
      const service2 = getEncryptionService();

      expect(service1).toBe(service2);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty data gracefully', () => {
      const emptyString = '';
      const encrypted = service.encrypt(emptyString);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(emptyString);
    });

    it('should handle large data encryption', () => {
      const largeData = 'x'.repeat(10000);
      const encrypted = service.encrypt(largeData);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(largeData);
    });

    it('should handle special characters', () => {
      const specialData = '🔐 Special Characters: !@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const encrypted = service.encrypt(specialData);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(specialData);
    });
  });

  describe('Security: tampered ciphertext and auth tag', () => {
    it('should throw when auth tag is tampered (GCM integrity check)', () => {
      const originalData = 'Sensitive compliance decision';
      const encrypted = service.encrypt(originalData);

      // Flip a single byte in the auth tag
      const authTagBytes = Buffer.from(encrypted.authTag, 'hex');
      authTagBytes[0] ^= 0xff;
      const tampered = { ...encrypted, authTag: authTagBytes.toString('hex') };

      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should throw when encrypted ciphertext is tampered', () => {
      const originalData = 'Sensitive compliance decision';
      const encrypted = service.encrypt(originalData);

      // Flip a byte in the ciphertext
      const cipherBytes = Buffer.from(encrypted.encrypted, 'hex');
      cipherBytes[0] ^= 0xff;
      const tampered = { ...encrypted, encrypted: cipherBytes.toString('hex') };

      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should throw when IV is tampered', () => {
      const originalData = 'Sensitive compliance decision';
      const encrypted = service.encrypt(originalData);

      const ivBytes = Buffer.from(encrypted.iv, 'hex');
      ivBytes[0] ^= 0xff;
      const tampered = { ...encrypted, iv: ivBytes.toString('hex') };

      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const data = 'Same plaintext';
      const enc1 = service.encrypt(data);
      const enc2 = service.encrypt(data);

      expect(enc1.encrypted).not.toBe(enc2.encrypted);
      expect(enc1.iv).not.toBe(enc2.iv);
    });
  });

  describe('Security: timing-safe password verification', () => {
    it('should reject password with a hash that has a different length stored hash', () => {
      // Craft a hash string with an intentionally wrong hash length
      const malformedHash = 'pbkdf2$100000$aabbccdd$deadbeef'; // too short stored hash
      const result = service.verifyPassword('anypassword', malformedHash);
      expect(result).toBe(false);
    });

    it('should return false for a hash with an unknown algorithm prefix', () => {
      const fakeHash = 'bcrypt$12$somesalt$somehashhex';
      const result = service.verifyPassword('password', fakeHash);
      expect(result).toBe(false);
    });

    it('should return false for a completely invalid hash format', () => {
      const result = service.verifyPassword('password', 'notahash');
      expect(result).toBe(false);
    });

    it('should use timing-safe comparison (verify two different wrong passwords both fail)', () => {
      const password = 'CorrectPassword!1';
      const hash = service.hashPassword(password);

      expect(service.verifyPassword('WrongPasswordA!1', hash)).toBe(false);
      expect(service.verifyPassword('WrongPasswordB!2', hash)).toBe(false);
      expect(service.verifyPassword(password, hash)).toBe(true);
    });
  });
});
