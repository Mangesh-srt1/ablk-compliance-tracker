/**
 * Manual mock for SqlLoader.
 * Jest resolves this automatically when jest.mock('../../../utils/sqlLoader') is called.
 */
const mockSqlLoader = {
  getQuery: jest.fn().mockReturnValue('SELECT 1'),
  loadQuery: jest.fn().mockReturnValue('SELECT 1'),
};

const SqlLoader = {
  getInstance: jest.fn().mockReturnValue(mockSqlLoader),
};

export default SqlLoader;
