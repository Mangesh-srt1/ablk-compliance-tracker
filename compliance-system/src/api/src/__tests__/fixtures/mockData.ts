/**
 * Test Fixtures - Mock Data
 * API service test data and mocks
 */

export const mockUsers = {
  compliance_officer: {
    id: 'user-1',
    email: 'officer@compliance.test',
    name: 'John Officer',
    role: 'compliance_officer',
    jurisdiction: 'AE',
    created_at: new Date('2026-01-01'),
    is_active: true,
  },
  analyst: {
    id: 'user-2',
    email: 'analyst@compliance.test',
    name: 'Jane Analyst',
    role: 'analyst',
    jurisdiction: 'IN',
    created_at: new Date('2026-01-01'),
    is_active: true,
  },
};

export const mockKYCRecords = {
  approved_ae: {
    id: 'kyc-1',
    wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
    jurisdiction_code: 'AE',
    full_name: 'Ahmed Al Maktoum',
    document_type: 'PASSPORT',
    status: 'APPROVED',
    risk_score: 15,
    confidence: 0.98,
    approved_at: new Date('2026-02-01'),
    created_at: new Date('2026-02-01'),
    tags: ['dubai', 'verified'],
  },
  pending_us: {
    id: 'kyc-2',
    wallet_address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    jurisdiction_code: 'US',
    full_name: 'John Smith',
    document_type: 'DRIVER_LICENSE',
    status: 'PENDING',
    risk_score: 45,
    confidence: 0.75,
    approved_at: null,
    created_at: new Date('2026-02-25'),
    tags: ['us-reg-d'],
  },
  rejected_in: {
    id: 'kyc-3',
    wallet_address: '0xfedcbafedcbafedcbafedcbafedcbafedcbafed',
    jurisdiction_code: 'IN',
    full_name: 'Rajesh Kumar',
    document_type: 'AADHAAR',
    status: 'REJECTED',
    risk_score: 85,
    confidence: 0.92,
    approved_at: null,
    created_at: new Date('2026-02-20'),
    tags: ['sanctions_match', 'pep'],
  },
};

export const mockAMLRecords = {
  low_risk: {
    id: 'aml-1',
    wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
    risk_score: 20,
    risk_level: 'LOW',
    flags: [],
    source: 'marble',
    created_at: new Date('2026-02-01'),
    last_checked: new Date('2026-02-25'),
  },
  high_risk: {
    id: 'aml-2',
    wallet_address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    risk_score: 75,
    risk_level: 'HIGH',
    flags: ['PEP_MATCH', 'SANCTIONS_SCREENING'],
    source: 'chainalysis',
    created_at: new Date('2026-02-20'),
    last_checked: new Date('2026-02-25'),
  },
};

export const mockComplianceChecks = {
  approved: {
    id: 'check-1',
    wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
    status: 'APPROVED',
    risk_score: 22,
    kyc_check_id: 'kyc-1',
    aml_check_id: 'aml-1',
    decision_reason: 'All checks passed. Low risk profile.',
    approved_by: 'user-1',
    created_at: new Date('2026-02-01'),
    updated_at: new Date('2026-02-01'),
  },
  escalated: {
    id: 'check-2',
    wallet_address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    status: 'ESCALATED',
    risk_score: 60,
    kyc_check_id: 'kyc-2',
    aml_check_id: 'aml-2',
    decision_reason: 'Medium-high risk score. Requires manual review.',
    approved_by: null,
    created_at: new Date('2026-02-25'),
    updated_at: new Date('2026-02-25'),
  },
  rejected: {
    id: 'check-3',
    wallet_address: '0xfedcbafedcbafedcbafedcbafedcbafedcbafed',
    status: 'REJECTED',
    risk_score: 85,
    kyc_check_id: 'kyc-3',
    aml_check_id: null,
    decision_reason: 'Sanctions match detected (OFAC list). Rejected per compliance policy.',
    approved_by: 'user-1',
    created_at: new Date('2026-02-20'),
    updated_at: new Date('2026-02-20'),
  },
};

export const mockTransactions = {
  valid_transfer: {
    id: 'tx-1',
    from_wallet: '0x1234567890abcdef1234567890abcdef12345678',
    to_wallet: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    amount: 100000,
    currency: 'USD',
    blockchain_tx_hash: '0xaaaa....',
    status: 'APPROVED',
    risk_score: 35,
    timestamp: new Date('2026-02-01T10:00:00Z'),
  },
  suspicious_transfer: {
    id: 'tx-2',
    from_wallet: '0x1234567890abcdef1234567890abcdef12345678',
    to_wallet: '0xfedcbafedcbafedcbafedcbafedcbafedcbafed',
    amount: 5000000,
    currency: 'USD',
    blockchain_tx_hash: '0xbbbb....',
    status: 'ESCALATED',
    risk_score: 72,
    timestamp: new Date('2026-02-25T14:30:00Z'),
  },
};

export const mockJurisdictionRules = {
  AE: {
    code: 'AE',
    name: 'United Arab Emirates - Dubai',
    kyc_required: true,
    min_fund_size: 150000,
    max_investor_annual_raise: 5000000,
    aml_threshold: 50000,
    governance: {
      major_changes_require_vote: true,
      voting_threshold: 66,
    },
  },
  US: {
    code: 'US',
    name: 'United States - Reg D',
    kyc_required: true,
    min_fund_size: 100000,
    max_investor_annual_raise: null,
    aml_threshold: 10000,
    governance: {
      major_changes_require_vote: false,
      voting_threshold: 0,
    },
  },
  IN: {
    code: 'IN',
    name: 'India - SEBI Regulations',
    kyc_required: true,
    min_fund_size: 50000,
    max_investor_annual_raise: 2000000,
    aml_threshold: 20000,
    governance: {
      major_changes_require_vote: true,
      voting_threshold: 51,
    },
  },
};

/**
 * Create a mock database pool
 */
export const createMockDatabasePool = () => ({
  connect: jest.fn().mockResolvedValue({
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn(),
  }),
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  end: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
});

/**
 * Create a mock Redis client
 */
export const createMockRedisClient = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(3600),
  flushAll: jest.fn().mockResolvedValue('OK'),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue('PONG'),
  on: jest.fn(),
});

/**
 * Create a mock Ballerine KYC client
 */
export const createMockBallerineClient = () => ({
  verify: jest.fn().mockResolvedValue({
    status: 'APPROVED',
    confidence: 0.98,
    document_id: 'doc-123',
  }),
  getStatus: jest.fn().mockResolvedValue('completed'),
});

/**
 * Create a mock Chainalysis AML client
 */
export const createMockChainalysisClient = () => ({
  screenWallet: jest.fn().mockResolvedValue({
    risk_score: 20,
    flags: [],
    match_type: 'none',
  }),
  getHistory: jest.fn().mockResolvedValue([]),
});
