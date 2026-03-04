-- Migration 002: Add blockchain monitoring support
-- Created: 2026-02-27 (Friday) - Prepared for Monday implementation
-- Purpose: Support real-time blockchain transaction monitoring
-- Status: NOT YET APPLIED (scheduled for Monday Mar 3 implementation)

BEGIN;

-- New table for blockchain monitoring configuration
CREATE TABLE IF NOT EXISTS blockchain_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(255) NOT NULL,
    blockchain_type VARCHAR(50) NOT NULL CHECK (blockchain_type IN ('permissioned', 'public')),
    jurisdiction VARCHAR(10) NOT NULL,
    rpc_endpoint VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(wallet_address, blockchain_type)
    -- Note: jurisdictions table removed, FK constraint disabled
);

-- New table for blockchain transaction logs
CREATE TABLE IF NOT EXISTS blockchain_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(255) NOT NULL,
    transaction_hash VARCHAR(255) NOT NULL UNIQUE,
    blockchain_type VARCHAR(50) NOT NULL,
    from_address VARCHAR(255),
    to_address VARCHAR(255),
    amount NUMERIC(20, 8),
    transaction_type VARCHAR(50),
    compliance_status VARCHAR(50) DEFAULT 'pending',
    risk_score NUMERIC(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- Note: entities table removed, FK constraint disabled
);

-- Indexes for blockchain monitoring
CREATE INDEX IF NOT EXISTS idx_blockchain_monitoring_active ON blockchain_monitoring(is_active);
CREATE INDEX IF NOT EXISTS idx_blockchain_transactions_status ON blockchain_transactions(compliance_status);
CREATE INDEX IF NOT EXISTS idx_blockchain_transactions_timestamp ON blockchain_transactions(created_at);

COMMIT;
