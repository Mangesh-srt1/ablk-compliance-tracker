/**
 * Manual mock for the database module.
 * Jest resolves this automatically when jest.mock('../../../config/database') is called.
 */
const db = {
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  connect: jest.fn().mockResolvedValue({
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn(),
  }),
  end: jest.fn().mockResolvedValue(undefined),
  isHealthy: jest.fn().mockReturnValue(true),
  getStats: jest.fn().mockReturnValue({ connected: true }),
};

export default db;
export const DatabaseConnection = jest.fn().mockImplementation(() => db);
