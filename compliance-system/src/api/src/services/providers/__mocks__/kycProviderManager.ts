/**
 * Manual mock for kycProviderManager.
 * Jest resolves this automatically when jest.mock('../../../services/providers/kycProviderManager') is called.
 */
export const kycProviderManager = {
  performCheck: jest.fn().mockResolvedValue({
    status: 'VERIFIED',
    confidence: 0.95,
    provider: 'mock',
    checkId: 'mock-check-id',
  }),
  getAvailableProviders: jest.fn().mockReturnValue(['mock']),
};
