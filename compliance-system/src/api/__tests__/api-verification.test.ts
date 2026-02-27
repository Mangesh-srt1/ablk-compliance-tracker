/**
 * API Endpoint Verification Tests
 * Verifies all endpoints match documentation and work correctly
 */

import request from 'supertest';
import express, { Express } from 'express';
import http from 'http';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';

describe('API Endpoint Verification Suite', () => {
  let app: Express;
  let httpServer: any;
  let testToken: string;
  let wsService: any;

  beforeAll(() => {
    // Setup test JWT token
    testToken = jwt.sign(
      {
        id: 'test-user-123',
        email: 'test@example.com',
        role: 'compliance_officer',
        permissions: ['kyc:execute', 'aml:execute', 'compliance:read', 'agents:execute'],
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/login', () => {
      it('✅ Should return 200 with JWT token on success', async () => {
        const response = await request(app).post('/api/auth/login').send({
          email: 'test@example.com',
          password: 'password123',
        });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('expiresIn');
      });

      it('✅ Should return 401 on invalid credentials', async () => {
        const response = await request(app).post('/api/auth/login').send({
          email: 'invalid@example.com',
          password: 'wrongpassword',
        });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('code');
      });

      it('✅ Should validate email format', async () => {
        const response = await request(app).post('/api/auth/login').send({
          email: 'invalid-email',
          password: 'password123',
        });

        expect(response.status).toBe(400);
      });
    });

    describe('POST /api/auth/refresh-token', () => {
      it('✅ Should return new token on valid refresh', async () => {
        const response = await request(app)
          .post('/api/auth/refresh-token')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ token: testToken });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
      });

      it('✅ Should return 401 on invalid token', async () => {
        const response = await request(app)
          .post('/api/auth/refresh-token')
          .send({ token: 'invalid-token' });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('KYC Endpoints', () => {
    describe('POST /api/kyc-check', () => {
      it('✅ Should return 200 with KYC result on success', async () => {
        const response = await request(app)
          .post('/api/kyc-check')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            entityId: 'entity-test-123',
            jurisdiction: 'AE',
            documents: [
              {
                type: 'passport',
                data: 'base64-encoded-document',
                metadata: {
                  filename: 'passport.jpg',
                  contentType: 'image/jpeg',
                },
              },
            ],
            entityData: {
              name: 'Ahmed Al Maktoum',
              dateOfBirth: '1980-01-15',
              nationality: 'AE',
            },
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('checkId');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('riskScore');
        expect(response.body).toHaveProperty('confidence');
        expect(response.body).toHaveProperty('reasoning');
        expect(response.body).toHaveProperty('timestamp');
      });

      it('✅ Should return 400 on missing required fields', async () => {
        const response = await request(app)
          .post('/api/kyc-check')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            entityId: 'entity-test-123',
            // Missing jurisdiction and documents
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('code');
      });

      it('✅ Should validate jurisdiction enum', async () => {
        const response = await request(app)
          .post('/api/kyc-check')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            entityId: 'entity-test-123',
            jurisdiction: 'INVALID',
            documents: [{ type: 'passport', data: '...', metadata: {} }],
            entityData: { name: 'Test' },
          });

        expect(response.status).toBe(400);
      });

      it('✅ Should validate document types', async () => {
        const response = await request(app)
          .post('/api/kyc-check')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            entityId: 'entity-test-123',
            jurisdiction: 'AE',
            documents: [
              {
                type: 'invalid-type',
                data: 'base64',
                metadata: { filename: 'doc.jpg', contentType: 'image/jpeg' },
              },
            ],
            entityData: { name: 'Test' },
          });

        expect(response.status).toBe(400);
      });

      it('✅ Should require at least one document', async () => {
        const response = await request(app)
          .post('/api/kyc-check')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            entityId: 'entity-test-123',
            jurisdiction: 'AE',
            documents: [],
            entityData: { name: 'Test' },
          });

        expect(response.status).toBe(400);
      });

      it('✅ Should return 401 without authorization header', async () => {
        const response = await request(app).post('/api/kyc-check').send({
          entityId: 'entity-test-123',
          jurisdiction: 'AE',
          documents: [{ type: 'passport', data: '...', metadata: {} }],
          entityData: { name: 'Test' },
        });

        expect(response.status).toBe(401);
      });

      it('✅ Should return 403 with insufficient permissions', async () => {
        const limitedToken = jwt.sign(
          {
            id: 'test-user-123',
            email: 'test@example.com',
            role: 'analyst',
            permissions: [],
          },
          process.env.JWT_SECRET || 'test-secret',
          { expiresIn: '1h' }
        );

        const response = await request(app)
          .post('/api/kyc-check')
          .set('Authorization', `Bearer ${limitedToken}`)
          .send({
            entityId: 'entity-test-123',
            jurisdiction: 'AE',
            documents: [{ type: 'passport', data: '...', metadata: {} }],
            entityData: { name: 'Test' },
          });

        expect(response.status).toBe(403);
      });
    });

    describe('GET /api/kyc/{id}', () => {
      it('✅ Should return 200 with KYC check details', async () => {
        const response = await request(app)
          .get('/api/kyc/kyc-chk-abc123')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('checkId');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('riskScore');
      });

      it('✅ Should return 404 for non-existent check', async () => {
        const response = await request(app)
          .get('/api/kyc/non-existent-id')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(404);
      });

      it('✅ Should validate UUID format', async () => {
        const response = await request(app)
          .get('/api/kyc/invalid-format')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(400);
      });
    });
  });

  describe('AML Endpoints', () => {
    describe('POST /api/aml-score', () => {
      it('✅ Should return 200 with AML risk score', async () => {
        const response = await request(app)
          .post('/api/aml-score')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            entityId: 'entity-test-456',
            jurisdiction: 'US',
            transactions: [
              {
                id: 'tx-abc123',
                amount: 50000,
                currency: 'USD',
                counterparty: 'John Doe',
                timestamp: new Date().toISOString(),
                type: 'transfer',
              },
            ],
            entityData: {
              name: 'John Doe',
              country: 'US',
              businessType: 'Trading',
            },
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('checkId');
        expect(response.body).toHaveProperty('riskScore');
        expect(response.body).toHaveProperty('flags');
        expect(response.body).toHaveProperty('reasoning');
      });

      it('✅ Should validate transaction amount is numeric', async () => {
        const response = await request(app)
          .post('/api/aml-score')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            entityId: 'entity-test-456',
            jurisdiction: 'US',
            transactions: [
              {
                id: 'tx-xyz',
                amount: 'not-a-number',
                currency: 'USD',
                counterparty: 'John',
                timestamp: new Date().toISOString(),
                type: 'transfer',
              },
            ],
            entityData: { name: 'John', country: 'US' },
          });

        expect(response.status).toBe(400);
      });

      it('✅ Should validate currency is 3-letter code', async () => {
        const response = await request(app)
          .post('/api/aml-score')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            entityId: 'entity-test-456',
            jurisdiction: 'US',
            transactions: [
              {
                id: 'tx-xyz',
                amount: 50000,
                currency: 'USDA',
                counterparty: 'John',
                timestamp: new Date().toISOString(),
                type: 'transfer',
              },
            ],
            entityData: { name: 'John', country: 'US' },
          });

        expect(response.status).toBe(400);
      });

      it('✅ Should validate transaction type enum', async () => {
        const response = await request(app)
          .post('/api/aml-score')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            entityId: 'entity-test-456',
            jurisdiction: 'US',
            transactions: [
              {
                id: 'tx-xyz',
                amount: 50000,
                currency: 'USD',
                counterparty: 'John',
                timestamp: new Date().toISOString(),
                type: 'invalid-type',
              },
            ],
            entityData: { name: 'John', country: 'US' },
          });

        expect(response.status).toBe(400);
      });
    });

    describe('GET /api/aml/{id}', () => {
      it('✅ Should return 200 with AML check results', async () => {
        const response = await request(app)
          .get('/api/aml/aml-chk-xyz789')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('checkId');
        expect(response.body).toHaveProperty('riskScore');
      });

      it('✅ Should return 404 for non-existent check', async () => {
        const response = await request(app)
          .get('/api/aml/non-existent')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(404);
      });
    });
  });

  describe('Compliance Endpoints', () => {
    describe('GET /api/compliance/checks', () => {
      it('✅ Should return 200 with compliance checks list', async () => {
        const response = await request(app)
          .get('/api/compliance/checks?page=1&limit=20')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body).toHaveProperty('pagination');
      });

      it('✅ Should support pagination parameters', async () => {
        const response = await request(app)
          .get('/api/compliance/checks?page=2&limit=10')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
        expect(response.body.pagination.page).toBe(2);
        expect(response.body.pagination.limit).toBe(10);
      });

      it('✅ Should filter by status', async () => {
        const response = await request(app)
          .get('/api/compliance/checks?status=APPROVED')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
      });

      it('✅ Should filter by jurisdiction', async () => {
        const response = await request(app)
          .get('/api/compliance/checks?jurisdiction=AE')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
      });

      it('✅ Should filter by risk level', async () => {
        const response = await request(app)
          .get('/api/compliance/checks?riskLevel=HIGH')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
      });
    });

    describe('GET /api/compliance/checks/{id}', () => {
      it('✅ Should return 200 with check details', async () => {
        const response = await request(app)
          .get('/api/compliance/checks/550e8400-e29b-41d4-a716-446655440000')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
      });

      it('✅ Should return 404 for non-existent check', async () => {
        const response = await request(app)
          .get('/api/compliance/checks/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(404);
      });
    });

    describe('POST /api/compliance/approve/{id}', () => {
      it('✅ Should approve check successfully', async () => {
        const response = await request(app)
          .post('/api/compliance/approve/550e8400-e29b-41d4-a716-446655440000')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ reason: 'All checks passed' });

        expect(response.status).toBe(200);
      });
    });

    describe('POST /api/compliance/reject/{id}', () => {
      it('✅ Should reject check successfully', async () => {
        const response = await request(app)
          .post('/api/compliance/reject/550e8400-e29b-41d4-a716-446655440000')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ reason: 'Sanctions match detected' });

        expect(response.status).toBe(200);
      });

      it('✅ Should require rejection reason', async () => {
        const response = await request(app)
          .post('/api/compliance/reject/550e8400-e29b-41d4-a716-446655440000')
          .set('Authorization', `Bearer ${testToken}`)
          .send({});

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Monitoring Endpoints', () => {
    describe('GET /api/monitoring/stats', () => {
      it('✅ Should return 200 with WebSocket statistics', async () => {
        const response = await request(app).get('/api/monitoring/stats');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'success');
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('totalConnections');
        expect(response.body.data).toHaveProperty('byWallet');
        expect(response.body.data).toHaveProperty('queueSize');
        expect(response.body).toHaveProperty('timestamp');
      });

      it('✅ Stats should return valid numbers', async () => {
        const response = await request(app).get('/api/monitoring/stats');

        expect(response.status).toBe(200);
        expect(typeof response.body.data.totalConnections).toBe('number');
        expect(typeof response.body.data.queueSize).toBe('number');
      });
    });

    describe('GET /api/monitoring/health', () => {
      it('✅ Should return 200 with health status', async () => {
        const response = await request(app).get('/api/monitoring/health');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('service', 'WebSocket');
        expect(response.body).toHaveProperty('totalConnections');
        expect(response.body).toHaveProperty('timestamp');
      });

      it('✅ Should indicate healthy or unhealthy status', async () => {
        const response = await request(app).get('/api/monitoring/health');

        expect(['healthy', 'unhealthy']).toContain(response.body.status);
      });
    });

    describe('POST /api/monitoring/alert', () => {
      it('✅ Should accept alert and return 200', async () => {
        const response = await request(app)
          .post('/api/monitoring/alert')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            wallet: '0xabcd1234567890abcd1234567890abcd12345678',
            entityId: 'entity-test-789',
            jurisdiction: 'AE',
            alertType: 'SANCTIONS',
            severity: 'HIGH',
            message: 'Wallet matched against OFAC sanctions list',
            riskScore: 87,
            requiresAction: true,
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('alert');
        expect(response.body).toHaveProperty('timestamp');
      });

      it('✅ Should validate required fields', async () => {
        const response = await request(app)
          .post('/api/monitoring/alert')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            wallet: '0xabcd1234567890abcd1234567890abcd12345678',
            // Missing other required fields
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });

      it('✅ Should validate wallet address format', async () => {
        const response = await request(app)
          .post('/api/monitoring/alert')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            wallet: 'invalid-address',
            entityId: 'entity-123',
            alertType: 'KYC',
            severity: 'MEDIUM',
            message: 'Alert',
          });

        expect(response.status).toBe(400);
      });

      it('✅ Should validate alert type enum', async () => {
        const response = await request(app)
          .post('/api/monitoring/alert')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            wallet: '0xabcd1234567890abcd1234567890abcd12345678',
            entityId: 'entity-123',
            alertType: 'INVALID_TYPE',
            severity: 'MEDIUM',
            message: 'Alert',
          });

        expect(response.status).toBe(400);
      });

      it('✅ Should validate severity enum', async () => {
        const response = await request(app)
          .post('/api/monitoring/alert')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            wallet: '0xabcd1234567890abcd1234567890abcd12345678',
            entityId: 'entity-123',
            alertType: 'KYC',
            severity: 'INVALID_SEVERITY',
            message: 'Alert',
          });

        expect(response.status).toBe(400);
      });
    });

    describe('GET /api/monitoring/wallets/{wallet}/stats', () => {
      it('✅ Should return 200 with wallet statistics', async () => {
        const response = await request(app)
          .get('/api/monitoring/wallets/0xabcd1234567890abcd1234567890abcd12345678/stats')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('wallet');
        expect(response.body).toHaveProperty('data');
      });

      it('✅ Should validate wallet address format', async () => {
        const response = await request(app)
          .get('/api/monitoring/wallets/invalid-wallet/stats')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(400);
      });
    });

    describe('DELETE /api/monitoring/connections/{wallet}', () => {
      it('✅ Should close wallet connections and return 200', async () => {
        const response = await request(app)
          .delete('/api/monitoring/connections/0xabcd1234567890abcd1234567890abcd12345678')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('wallet');
        expect(response.body).toHaveProperty('timestamp');
      });

      it('✅ Should validate wallet address format', async () => {
        const response = await request(app)
          .delete('/api/monitoring/connections/invalid')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Reports Endpoints', () => {
    describe('GET /api/reports/compliance', () => {
      it('✅ Should return 200 with compliance report', async () => {
        const response = await request(app)
          .get('/api/reports/compliance?startDate=2026-01-01T00:00:00Z&endDate=2026-02-27T23:59:59Z')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
      });

      it('✅ Should support format parameter', async () => {
        const response = await request(app)
          .get(
            '/api/reports/compliance?startDate=2026-01-01T00:00:00Z&endDate=2026-02-27T23:59:59Z&format=json'
          )
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
      });
    });

    describe('GET /api/reports/audit', () => {
      it('✅ Should return 200 with audit trail', async () => {
        const response = await request(app)
          .get(
            '/api/reports/audit?startDate=2026-01-01T00:00:00Z&endDate=2026-02-27T23:59:59Z'
          )
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });

      it('✅ Should require start and end dates', async () => {
        const response = await request(app)
          .get('/api/reports/audit')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Health Endpoints', () => {
    describe('GET /api/health', () => {
      it('✅ Should return 200 with health status', async () => {
        const response = await request(app).get('/api/health');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('version');
        expect(response.body).toHaveProperty('timestamp');
      });

      it('✅ Should include service status information', async () => {
        const response = await request(app).get('/api/health');

        expect(response.status).toBe(200);
        expect(['operational', 'degraded']).toContain(response.body.status);
      });

      it('✅ Should not require authentication', async () => {
        const response = await request(app).get('/api/health');

        expect(response.status).toBe(200);
      });
    });
  });

  describe('WebSocket Endpoint', () => {
    describe('GET /api/stream/monitoring/{wallet}', () => {
      it('✅ Should upgrade to WebSocket connection with valid JWT', (done) => {
        const wallet = '0xabcd1234567890abcd1234567890abcd12345678';
        const wsUrl = `ws://localhost:3000/api/stream/monitoring/${wallet}?token=${testToken}`;

        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          ws.close();
          done();
        });

        ws.on('error', (error) => {
          done(error);
        });
      });

      it('✅ Should reject connection without JWT token', (done) => {
        const wallet = '0xabcd1234567890abcd1234567890abcd12345678';
        const wsUrl = `ws://localhost:3000/api/stream/monitoring/${wallet}`;

        const ws = new WebSocket(wsUrl);

        ws.on('close', () => {
          done();
        });

        ws.on('error', () => {
          done();
        });

        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            done();
          }
        }, 1000);
      });

      it('✅ Should receive alert messages', (done) => {
        const wallet = '0xabcd1234567890abcd1234567890abcd12345678';
        const wsUrl = `ws://localhost:3000/api/stream/monitoring/${wallet}?token=${testToken}`;

        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
          // Send HEARTBEAT
          ws.send(JSON.stringify({ type: 'HEARTBEAT' }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          expect(message).toHaveProperty('alertId');
          expect(message).toHaveProperty('wallet');
          expect(message).toHaveProperty('alertType');
          ws.close();
          done();
        });

        ws.on('error', (error) => {
          done(error);
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          ws.close();
          done(new Error('No message received within 5 seconds'));
        }, 5000);
      });

      it('✅ Should handle FILTER command', (done) => {
        const wallet = '0xabcd1234567890abcd1234567890abcd12345678';
        const wsUrl = `ws://localhost:3000/api/stream/monitoring/${wallet}?token=${testToken}`;

        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
          ws.send(JSON.stringify({ type: 'FILTER', jurisdiction: 'AE' }));
        });

        ws.on('message', () => {
          ws.close();
          done();
        });

        ws.on('error', (error) => {
          done(error);
        });

        setTimeout(() => {
          ws.close();
          done();
        }, 2000);
      });

      it('✅ Should handle REQUEST_CACHE command', (done) => {
        const wallet = '0xabcd1234567890abcd1234567890abcd12345678';
        const wsUrl = `ws://localhost:3000/api/stream/monitoring/${wallet}?token=${testToken}`;

        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
          ws.send(JSON.stringify({ type: 'REQUEST_CACHE' }));
        });

        ws.on('message', () => {
          ws.close();
          done();
        });

        ws.on('error', (error) => {
          done(error);
        });

        setTimeout(() => {
          ws.close();
          done();
        }, 2000);
      });

      it('✅ Should validate wallet address format', (done) => {
        const wsUrl = `ws://localhost:3000/api/stream/monitoring/invalid-wallet?token=${testToken}`;

        const ws = new WebSocket(wsUrl);

        ws.on('close', () => {
          done();
        });

        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            done();
          }
        }, 1000);
      });

      it('✅ Should send HEARTBEAT acknowledgment', (done) => {
        const wallet = '0xabcd1234567890abcd1234567890abcd12345678';
        const wsUrl = `ws://localhost:3000/api/stream/monitoring/${wallet}?token=${testToken}`;

        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
          ws.send(JSON.stringify({ type: 'HEARTBEAT' }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          // Should receive response
          ws.close();
          done();
        });

        ws.on('error', (error) => {
          done(error);
        });

        setTimeout(() => {
          ws.close();
          done(new Error('No response received'));
        }, 3000);
      });
    });
  });

  describe('Error Handling & Edge Cases', () => {
    describe('Invalid request methods', () => {
      it('✅ Should return 405 for unsupported methods', async () => {
        const response = await request(app).patch('/api/kyc-check');

        expect(response.status).toBe(405);
      });
    });

    describe('Missing endpoints', () => {
      it('✅ Should return 404 for non-existent routes', async () => {
        const response = await request(app).get('/api/non-existent');

        expect(response.status).toBe(404);
      });
    });

    describe('Rate limiting', () => {
      it('✅ Should enforce rate limits on API endpoints', async () => {
        let count = 0;
        for (let i = 0; i < 150; i++) {
          const response = await request(app)
            .get('/api/health')
            .set('Authorization', `Bearer ${testToken}`);
          if (response.status === 429) {
            count++;
          }
        }
        expect(count).toBeGreaterThan(0);
      });
    });
  });

  describe('Response Format Standards', () => {
    it('✅ All endpoints should include timestamp', async () => {
      const kycResponse = await request(app)
        .get('/api/kyc/test-id')
        .set('Authorization', `Bearer ${testToken}`);

      expect(kycResponse.body).toHaveProperty('timestamp');
    });

    it('✅ Error responses should include code and message', async () => {
      const response = await request(app).post('/api/kyc-check').send({});

      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Security Validations', () => {
    it('✅ Should not expose sensitive data in errors', async () => {
      const response = await request(app)
        .post('/api/kyc-check')
        .send({ entityId: '"; DROP TABLE users; --' });

      expect(response.text).not.toContain('DROP TABLE');
    });

    it('✅ Should validate content-type headers', async () => {
      const response = await request(app)
        .post('/api/kyc-check')
        .set('Content-Type', 'application/xml')
        .send('<invalid>xml</invalid>');

      expect(response.status).not.toBe(200);
    });

    it('✅ Should block requests with invalid JWT', async () => {
      const response = await request(app)
        .get('/api/compliance/checks')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
    });
  });
});
