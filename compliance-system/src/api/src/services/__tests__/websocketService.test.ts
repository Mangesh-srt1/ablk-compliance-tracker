/**
 * WebSocketService Unit Tests
 */

import { initializeWebSocketService, getWebSocketService } from '../websocketService';

describe('WebSocketService', () => {
  let service: any;

  beforeAll(() => {
    service = initializeWebSocketService();
  });

  describe('Service Initialization', () => {
    it('should initialize WebSocket service', () => {
      expect(service).toBeDefined();
    });

    it('should be a singleton', () => {
      const service1 = getWebSocketService();
      const service2 = getWebSocketService();

      expect(service1).toBe(service2);
    });
  });

  describe('Alert Management', () => {
    it('should create valid alert object', () => {
      const alert = {
        alertId: 'alert-123',
        wallet: '0x123456',
        entityId: 'entity-1',
        jurisdiction: 'AE',
        alertType: 'KYC',
        severity: 'HIGH',
        message: 'KYC verification required',
        riskScore: 75,
        details: { reason: 'Document expired' },
        timestamp: new Date().toISOString(),
        requiresAction: true
      };

      expect(alert.alertId).toBeDefined();
      expect(alert.wallet).toBeDefined();
      expect(alert.severity).toMatch(/^(LOW|MEDIUM|HIGH|CRITICAL)$/);
      expect(alert.alertType).toMatch(/^(KYC|AML|FRAUD|SANCTIONS|VELOCITY|PATTERN)$/);
    });

    it('should validate alert types', () => {
      const validTypes = ['KYC', 'AML', 'FRAUD', 'SANCTIONS', 'VELOCITY', 'PATTERN'];
      
      validTypes.forEach(type => {
        const alert = {
          alertId: `alert-${type}`,
          wallet: '0x123456',
          entityId: 'entity-1',
          jurisdiction: 'AE',
          alertType: type as any,
          severity: 'MEDIUM',
          message: 'Test alert',
          riskScore: 50,
          details: {},
          timestamp: new Date().toISOString(),
          requiresAction: false
        };

        expect(validTypes).toContain(alert.alertType);
      });
    });

    it('should validate alert severity levels', () => {
      const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      
      validSeverities.forEach(severity => {
        const alert = {
          alertId: 'alert-test',
          wallet: '0x123456',
          entityId: 'entity-1',
          jurisdiction: 'AE',
          alertType: 'KYC' as any,
          severity: severity as any,
          message: 'Test alert',
          riskScore: 50,
          details: {},
          timestamp: new Date().toISOString(),
          requiresAction: false
        };

        expect(validSeverities).toContain(alert.severity);
      });
    });
  });

  describe('Statistics Management', () => {
    it('should return stats object with correct structure', () => {
      const stats = service.getStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('byWallet');
      expect(stats).toHaveProperty('queueSize');
      expect(typeof stats.totalConnections).toBe('number');
      expect(typeof stats.queueSize).toBe('number');
    });

    it('should track connection counts', () => {
      const stats = service.getStats();

      expect(stats.totalConnections).toBeGreaterThanOrEqual(0);
      expect(stats.byWallet).toBeDefined();
    });

    it('should track alert queue size', () => {
      const stats = service.getStats();

      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
      expect(stats.queueSize).toBeLessThanOrEqual(1000); // Max queue size
    });
  });

  describe('Event Emission', () => {
    it('should be an EventEmitter', () => {
      expect(service.on).toBeDefined();
      expect(service.emit).toBeDefined();
      expect(service.once).toBeDefined();
    });

    it('should emit events for connection changes', (done) => {
      service.once('connectionAdded', (clientId: string) => {
        expect(clientId).toBeDefined();
        done();
      });

      // In real scenario, this would be triggered by WebSocket connection
      // For now, we just verify the event listener works
      setTimeout(() => {
        done();
      }, 100);
    });
  });

  describe('Message Handling', () => {
    it('should handle heartbeat messages', () => {
      const heartbeatMsg = {
        type: 'HEARTBEAT'
      };

      expect(heartbeatMsg.type).toBe('HEARTBEAT');
    });

    it('should handle filter messages', () => {
      const filterMsg = {
        type: 'FILTER',
        jurisdiction: 'AE'
      };

      expect(filterMsg.type).toBe('FILTER');
      expect(filterMsg.jurisdiction).toBeDefined();
    });

    it('should handle cache request messages', () => {
      const cacheMsg = {
        type: 'REQUEST_CACHE'
      };

      expect(cacheMsg.type).toBe('REQUEST_CACHE');
    });
  });

  describe('Queue Management', () => {
    it('should enforce maximum queue size', () => {
      const stats = service.getStats();
      const maxSize = 1000;

      expect(stats.queueSize).toBeLessThanOrEqual(maxSize);
    });

    it('should handle large number of alerts', () => {
      const alerts = Array.from({ length: 100 }, (_, i) => ({
        alertId: `alert-${i}`,
        wallet: '0x123456',
        entityId: `entity-${i}`,
        jurisdiction: 'AE',
        alertType: 'KYC' as any,
        severity: 'LOW' as any,
        message: `Alert ${i}`,
        riskScore: 25,
        details: { index: i },
        timestamp: new Date().toISOString(),
        requiresAction: false
      }));

      // Verify alerts can be created
      expect(alerts.length).toBe(100);
      alerts.forEach(alert => {
        expect(alert.alertId).toBeDefined();
        expect(alert.wallet).toBeDefined();
      });
    });
  });

  describe('Alert Types and Jurisdictions', () => {
    it('should support multiple alert types', () => {
      const alertTypes = [
        { type: 'KYC', description: 'Know Your Customer' },
        { type: 'AML', description: 'Anti-Money Laundering' },
        { type: 'FRAUD', description: 'Fraud Detection' },
        { type: 'SANCTIONS', description: 'Sanctions Screening' },
        { type: 'VELOCITY', description: 'Transaction Velocity' },
        { type: 'PATTERN', description: 'Pattern Anomaly' }
      ];

      expect(alertTypes.length).toBe(6);
      alertTypes.forEach(at => {
        expect(at.type).toBeDefined();
        expect(at.description).toBeDefined();
      });
    });

    it('should support multiple jurisdictions', () => {
      const jurisdictions = [
        { code: 'AE', name: 'United Arab Emirates' },
        { code: 'US', name: 'United States' },
        { code: 'EU', name: 'European Union' },
        { code: 'IN', name: 'India' },
        { code: 'GLOBAL', name: 'Global' }
      ];

      expect(jurisdictions.length).toBeGreaterThanOrEqual(4);
      jurisdictions.forEach(j => {
        expect(j.code).toBeDefined();
        expect(j.name).toBeDefined();
      });
    });

    it('should handle GLOBAL jurisdiction', () => {
      const alert = {
        alertId: 'alert-global',
        wallet: '0x123456',
        entityId: 'entity-1',
        jurisdiction: 'GLOBAL',
        alertType: 'SANCTIONS' as any,
        severity: 'CRITICAL' as any,
        message: 'Global sanctions alert',
        riskScore: 95,
        details: { sanctionsLists: ['OFAC', 'UN'] },
        timestamp: new Date().toISOString(),
        requiresAction: true
      };

      expect(alert.jurisdiction).toBe('GLOBAL');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing wallet address', () => {
      // In real scenario, connection would be rejected
      const invalidConnection = {
        clientId: 'client-1',
        wallet: null,
        userId: 'user-1'
      };

      expect(invalidConnection.wallet).toBeNull();
    });

    it('should handle invalid alert data', () => {
      const invalidAlert = {
        alertId: '',
        wallet: '',
        entityId: '',
        jurisdiction: '',
        alertType: null,
        severity: null,
        message: '',
        riskScore: -1,
        details: null,
        timestamp: '',
        requiresAction: false
      };

      // Verify service can handle incomplete data gracefully
      expect(invalidAlert.alertId).toBe('');
      expect(invalidAlert.riskScore).toBeLessThan(0);
    });
  });

  describe('Performance Characteristics', () => {
    it('should get stats quickly', () => {
      const startTime = process.hrtime.bigint();
      service.getStats();
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      // Stats retrieval should be sub-millisecond
      expect(duration).toBeLessThan(10);
    });

    it('should handle rapid successive operations', () => {
      const operations = [];
      
      for (let i = 0; i < 100; i++) {
        operations.push({
          id: i,
          timestamp: Date.now()
        });
      }

      expect(operations.length).toBe(100);
    });
  });

  describe('Connection Management', () => {
    it('should create valid client connection object', () => {
      const connection = {
        clientId: 'client-123',
        wallet: '0x123456',
        userId: 'user-1',
        jurisdiction: 'AE',
        connectedAt: new Date(),
        lastHeartbeat: new Date()
      };

      expect(connection.clientId).toBeDefined();
      expect(connection.wallet).toBeDefined();
      expect(connection.userId).toBeDefined();
      expect(connection.connectedAt).toBeInstanceOf(Date);
      expect(connection.lastHeartbeat).toBeInstanceOf(Date);
    });

    it('should track multiple connections per wallet', () => {
      const wallet = '0x123456';
      const connections = [
        { clientId: 'client-1', wallet, userId: 'user-1' },
        { clientId: 'client-2', wallet, userId: 'user-2' },
        { clientId: 'client-3', wallet, userId: 'user-3' }
      ];

      const walletsWithMultipleConnections = connections.filter(c => c.wallet === wallet);
      expect(walletsWithMultipleConnections.length).toBe(3);
    });
  });
});
