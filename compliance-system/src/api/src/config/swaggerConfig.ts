/**
 * Swagger/OpenAPI UI Configuration
 * Serves interactive API documentation at /api-docs
 */

import express, { Express } from 'express';
// Note: swagger-ui-express and yaml dependencies required
// Install with: npm install swagger-ui-express yaml @types/swagger-ui-express @types/yaml
import fs from 'fs';
import path from 'path';
import winston from 'winston';

let swaggerUi: any;
let YAML: any;

try {
  swaggerUi = require('swagger-ui-express');
  YAML = require('yaml');
} catch (error) {
  console.warn('swagger-ui-express or yaml not installed. Install with: npm install swagger-ui-express yaml @types/swagger-ui-express @types/yaml');
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

/**
 * Configure Swagger UI for API documentation
 * 
 * Serves at:
 * - /api-docs - Interactive Swagger UI
 * - /api-docs.json - OpenAPI spec in JSON format
 * - /api-docs.yaml - OpenAPI spec in YAML format
 */
export const configureSwaggerUI = (app: Express): void => {
  try {
    if (!swaggerUi || !YAML) {
      logger.warn('Swagger UI dependencies not available. Skipping configuration.');
      return;
    }
    
    // Load OpenAPI spec
    const openApiPath = path.join(__dirname, '../docs/openapi.yaml');
    const openApiContent = fs.readFileSync(openApiPath, 'utf-8');
    
    // Parse YAML to JSON
    const openApiSpec = YAML.parse(openApiContent);
    
    // Update server URLs based on environment
    if (process.env.NODE_ENV === 'production') {
      openApiSpec.servers = [
        {
          url: process.env.API_BASE_URL || 'https://api.ableka.io',
          description: 'Production API',
        },
      ];
    } else {
      openApiSpec.servers = [
        {
          url: `http://localhost:${process.env.API_PORT || 3000}`,
          description: 'Development API',
        },
      ];
    }

    // Custom Swagger UI options
    const swaggerOptions = {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Ableka Lumina - Compliance API',
      swaggerOptions: {
        persistAuthorization: true,
        displayOperationId: true,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        tagsSorter: 'alpha',
        operationsSorter: 'method',
        // Pre-fill JWT token if available
        apiKeySelectorKey: 'Authorization',
      },
      explorer: true,
    };

    // Serve Swagger UI at /api-docs
    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(openApiSpec, swaggerOptions)
    );

    // Serve raw OpenAPI spec in JSON format
    app.get('/api-docs.json', (req, res) => {
      res.json(openApiSpec);
    });

    // Serve raw OpenAPI spec in YAML format
    app.get('/api-docs.yaml', (req, res) => {
      res.type('application/yaml').send(openApiContent);
    });

    logger.info('✅ Swagger UI configured', {
      url: '/api-docs',
      spec: '/api-docs.json',
      yaml: '/api-docs.yaml',
    });
  } catch (error) {
    logger.error('❌ Failed to configure Swagger UI', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Middleware to inject API documentation link in responses
 */
export const apiDocsMiddleware = (req: any, res: any, next: any) => {
  // Add Link header pointing to API docs
  res.setHeader('Link', '</api-docs>; rel="documentation"; title="API Documentation"');
  next();
};

/**
 * Health check endpoint that includes docs link
 */
export const setupDocsHealthCheck = (app: Express): void => {
  app.get('/api/docs-check', (req, res) => {
    res.json({
      status: 'healthy',
      documentation: {
        swagger: 'http://localhost:3000/api-docs',
        json: 'http://localhost:3000/api-docs.json',
        yaml: 'http://localhost:3000/api-docs.yaml',
        postman_collection: 'http://localhost:3000/postman-collection.json',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Serve Postman collection
  app.get('/postman-collection.json', (req, res) => {
    try {
      const postmanPath = path.join(__dirname, '../docs/postman-collection.json');
      const postmanCollection = fs.readFileSync(postmanPath, 'utf-8');
      res.type('application/json').send(postmanCollection);
    } catch (error) {
      logger.error('Failed to serve Postman collection', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to serve Postman collection' });
    }
  });
};
