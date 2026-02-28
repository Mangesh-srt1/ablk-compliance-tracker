const db = {
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  connect: jest.fn().mockResolvedValue({ query: jest.fn(), release: jest.fn() }),
  end: jest.fn().mockResolvedValue(undefined),
};
export default db;
