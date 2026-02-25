/**
 * SQL Query Loader Utility
 * Loads externalized SQL queries from files
 */

import * as fs from 'fs';
import * as path from 'path';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/sql-loader.log' })
  ]
});

class SqlLoader {
  private static instance: SqlLoader;
  private queries: Map<string, string> = new Map();
  private scriptsPath: string;

  private constructor() {
    this.scriptsPath = path.join(__dirname, '../../../scripts');
    this.loadAllQueries();
  }

  public static getInstance(): SqlLoader {
    if (!SqlLoader.instance) {
      SqlLoader.instance = new SqlLoader();
    }
    return SqlLoader.instance;
  }

  private loadAllQueries(): void {
    try {
      this.loadQueriesFromDirectory('compliance_checks');
      this.loadQueriesFromDirectory('compliance_rules');
      logger.info('All SQL queries loaded successfully');
    } catch (error) {
      logger.error('Failed to load SQL queries', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private loadQueriesFromDirectory(dirName: string): void {
    const dirPath = path.join(this.scriptsPath, dirName);

    if (!fs.existsSync(dirPath)) {
      logger.warn(`SQL directory not found: ${dirPath}`);
      return;
    }

    const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.sql'));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const queryName = `${dirName}/${file.replace('.sql', '')}`;
      const queryContent = fs.readFileSync(filePath, 'utf-8').trim();

      this.queries.set(queryName, queryContent);
      logger.debug(`Loaded SQL query: ${queryName}`);
    }
  }

  public getQuery(queryName: string): string {
    const query = this.queries.get(queryName);
    if (!query) {
      const error = `SQL query not found: ${queryName}`;
      logger.error(error);
      throw new Error(error);
    }
    return query;
  }

  public getAllQueries(): Map<string, string> {
    return new Map(this.queries);
  }

  public reloadQueries(): void {
    this.queries.clear();
    this.loadAllQueries();
  }
}

export default SqlLoader;