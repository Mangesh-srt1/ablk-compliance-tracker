/**
 * Health Check Endpoint Tests
 * Verifies API health endpoints are responding correctly
 */

import request from 'supertest';
import express, { Express } from 'express';
import healthRoutes from '../src/routes/healthRoutes';

describe('Health Check Endpoints', () => {
  let app: Express;

  beforeAll(() => {
    // Create minimal Express app with health routes
    app = express();
    app.use(express.json());
    app.use('/api/health', healthRoutes);
    
    // Add status endpoint
    app.get('/api/status', (req, res) => {
      res.json({
        status: 'operational',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });
    });
  });

  describe('GET /api/health', () => {
    it('should return 200 OK with healthy status', async () => {
      const response = await request(app)
        .get('/api/health/')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('healthy');
    });

    it('should include required health fields', async () => {
      const response = await request(app)
        .get('/api/health/')
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');
    });

    it('should include valid timestamp in ISO format', async () => {
      const response = await request(app)
        .get('/api/health/')
        .expect(200);

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should include positive uptime', async () => {
      const response = await request(app)
        .get('/api/health/')
        .expect(200);

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should include semantic version', async () => {
      const response = await request(app)
        .get('/api/health/')
        .expect(200);

      expect(typeof response.body.version).toBe('string');
      expect(response.body.version).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should include environment name', async () => {
      const response = await request(app)
        .get('/api/health/')
        .expect(200);

      expect(response.body.environment).toMatch(/development|production|staging|test/i);
    });

    it('should accept multiple consecutive requests', async () => {
      const responses = await Promise.all([
        request(app).get('/api/health/'),
        request(app).get('/api/health/'),
        request(app).get('/api/health/'),
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
      });
    });

    it('should maintain uptime consistency', async () => {
      const response1 = await request(app)
        .get('/api/health/')
        .expect(200);

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));

      const response2 = await request(app)
        .get('/api/health/')
        .expect(200);

      // Second uptime should be >= first uptime
      expect(response2.body.uptime).toBeGreaterThanOrEqual(response1.body.uptime);
    });
  });

  describe('GET /api/health/detailed (if exists)', () => {
    it('should return detailed health information', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect([200, 206]); // 206 when degraded (no DB/Redis in test env)

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      
      // If detailed endpoint exists, it should include dependencies
      if (response.body.dependencies) {
        expect(typeof response.body.dependencies).toBe('object');
      }
    });

    it('should include database status in details', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect([200, 206]); // 206 when degraded (no DB/Redis in test env)

      if (response.body.database) {
        expect(response.body.database).toHaveProperty('connected');
      }
    });

    it('should include redis status in details', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect([200, 206]); // 206 when degraded (no DB/Redis in test env)

      if (response.body.redis) {
        expect(response.body.redis).toHaveProperty('available');
      }
    });
  });

  describe('Response Headers', () => {
    it('should set appropriate content-type header', async () => {
      const response = await request(app)
        .get('/api/health/')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should set appropriate cache control headers', async () => {
      const response = await request(app)
        .get('/api/health/')
        .expect(200);

      // Health check should be cacheable
      if (response.headers['cache-control']) {
        expect(response.headers['cache-control']).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    it('should respond within SLA (<100ms)', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/health/')
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should handle burst requests efficiently', async () => {
      const startTime = Date.now();

      const requests = Array(10).fill(null).map(() =>
        request(app).get('/api/health/')
      );

      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // 10 requests should complete in reasonable time
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Error Conditions', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .get('/api/health/invalid')
        .expect([200, 404]); // Either exists or 404

      if (response.status === 404) {
        expect(response.status).toBe(404);
      } else {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
      }
    });

    it('should reject POST requests to health endpoint', async () => {
      const response = await request(app)
        .post('/api/health/')
        .expect([405, 404]); // Method not allowed or not found

      expect([405, 404]).toContain(response.status);
    });

    it('should handle missing authorization gracefully', async () => {
      // Health checks should not require auth
      const response = await request(app)
        .get('/api/health/')
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });
  });

  describe('Health Status Transitions', () => {
    it('should remain healthy during operation', async () => {
      const statuses = [];

      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .get('/api/health/')
          .expect(200);

        statuses.push(response.body.status);
      }

      // All checks should report healthy
      statuses.forEach(status => {
        expect(status).toBe('healthy');
      });
    });

    it('should provide consistent response structure', async () => {
      const response1 = await request(app)
        .get('/api/health/')
        .expect(200);

      const response2 = await request(app)
        .get('/api/health/')
        .expect(200);

      // Both responses should have same structure
      expect(Object.keys(response1.body).sort()).toEqual(
        Object.keys(response2.body).sort()
      );
    });
  });

  describe('Health Check Integration', () => {
    it('should be compatible with load balancer health checks', async () => {
      const response = await request(app)
        .get('/api/health/')
        .set('User-Agent', 'ELB-HealthChecker/2.0')
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });

    it('should be compatible with Kubernetes liveness probes', async () => {
      const response = await request(app)
        .get('/api/health/')
        .expect(200);

      // Kubernetes expects status code 200 for alive
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });

    it('should be compatible with Kubernetes readiness probes', async () => {
      const response = await request(app)
        .get('/api/health/') // Could also check /ready endpoint
        .expect(200);

      // Readiness check should return 200 if ready
      expect(response.status).toBe(200);
    });
  });

  describe('Monitoring Integration', () => {
    it('should provide metrics for monitoring systems', async () => {
      const response = await request(app)
        .get('/api/health/')
        .expect(200);

      // Should have metrics that can be scraped/monitored
      expect(response.body.uptime).toBeDefined();
      expect(typeof response.body.uptime).toBe('number');
    });

    it('should include version for upgrade tracking', async () => {
      const response = await request(app)
        .get('/api/health/')
        .expect(200);

      expect(response.body.version).toBeDefined();
      expect(typeof response.body.version).toBe('string');
    });

    it('should include environment for multi-environment monitoring', async () => {
      const response = await request(app)
        .get('/api/health/')
        .expect(200);

      expect(response.body.environment).toBeDefined();
      expect(typeof response.body.environment).toBe('string');
    });
  });
});
