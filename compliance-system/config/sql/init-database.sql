-- Initialize Ableka Lumina Compliance Database
-- This SQL script creates all necessary tables and extensions

-- Enable pgvector extension for vector similarity search (optional)
-- Note: pgvector requires separate installation in Alpine-based PostgreSQL
-- For development, we skip it. For production, use pgvector-enabled PostgreSQL image.
-- CREATE EXTENSION IF NOT EXISTS pgvector;

-- UUID extension is built-in
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Enums and Types
-- ============================================================================

CREATE TYPE check_status AS ENUM ('pending', 'approved', 'rejected', 'escalated', 'manual_review');
CREATE TYPE entity_type AS ENUM ('individual', 'company', 'trust', 'fund');

-- ============================================================================
-- Core Tables
-- ============================================================================

-- Users/Officers table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'analyst',
    jurisdiction VARCHAR(20),
    active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- KYC Checks table
CREATE TABLE IF NOT EXISTS kyc_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id VARCHAR(255) NOT NULL,
    entity_type entity_type NOT NULL DEFAULT 'individual',
    jurisdiction VARCHAR(20) NOT NULL,
    status check_status NOT NULL DEFAULT 'pending',
    score DECIMAL(5,2),
    flags JSONB,
    recommendations TEXT,
    documents JSONB,
    entity_data JSONB NOT NULL,
    processing_time INTEGER,
    verified_at TIMESTAMP,
    verified_by UUID REFERENCES users(id),
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AML Checks table
CREATE TABLE IF NOT EXISTS aml_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255),
    jurisdiction VARCHAR(20) NOT NULL,
    status check_status NOT NULL DEFAULT 'pending',
    risk_score DECIMAL(5,2),
    risk_level VARCHAR(20),
    pep_match BOOLEAN DEFAULT false,
    sanctions_match BOOLEAN DEFAULT false,
    flags JSONB,
    transaction_history JSONB,
    processing_time INTEGER,
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compliance Checks (aggregate)
CREATE TABLE IF NOT EXISTS compliance_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id VARCHAR(255) NOT NULL,
    jurisdiction VARCHAR(20) NOT NULL,
    overall_status check_status NOT NULL DEFAULT 'pending',
    risk_score DECIMAL(5,2),
    kyc_check_id UUID REFERENCES kyc_checks(id),
    aml_check_id UUID REFERENCES aml_checks(id),
    flags JSONB,
    reasoning TEXT,
    approved_at TIMESTAMP,
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compliance Rules table
CREATE TABLE IF NOT EXISTS compliance_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jurisdiction VARCHAR(20) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    rule_category VARCHAR(100),
    rule_content JSONB NOT NULL,
    active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Decision Embeddings (for pattern learning)
-- Note: Using BYTEA instead of vector(384) since pgvector isn't available in Alpine PostgreSQL
-- In production with pgvector enabled, change BYTEA to vector(384) for similarity search
CREATE TABLE IF NOT EXISTS decision_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    check_id UUID NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    embedding BYTEA,  -- Store embeddings as bytes (can be converted to vector with pgvector)
    risk_score DECIMAL(5,2),
    flags TEXT[],
    decision_status check_status,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(id),
    entity_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    changes JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- KYC Checks indexes
CREATE INDEX idx_kyc_entity_id ON kyc_checks(entity_id);
CREATE INDEX idx_kyc_jurisdiction ON kyc_checks(jurisdiction);
CREATE INDEX idx_kyc_status ON kyc_checks(status);
CREATE INDEX idx_kyc_created_at ON kyc_checks(created_at DESC);

-- AML Checks indexes
CREATE INDEX idx_aml_entity_id ON aml_checks(entity_id);
CREATE INDEX idx_aml_wallet ON aml_checks(wallet_address);
CREATE INDEX idx_aml_jurisdiction ON aml_checks(jurisdiction);
CREATE INDEX idx_aml_status ON aml_checks(status);
CREATE INDEX idx_aml_created_at ON aml_checks(created_at DESC);

-- Compliance Checks indexes
CREATE INDEX idx_cc_entity_id ON compliance_checks(entity_id);
CREATE INDEX idx_cc_jurisdiction ON compliance_checks(jurisdiction);
CREATE INDEX idx_cc_status ON compliance_checks(overall_status);
CREATE INDEX idx_cc_created_at ON compliance_checks(created_at DESC);

-- Decision Vectors indexes
CREATE INDEX idx_dv_check_id ON decision_vectors(check_id);
CREATE INDEX idx_dv_entity_id ON decision_vectors(entity_id);
-- pgvector index disabled - only available when pgvector extension is installed
-- CREATE INDEX idx_dv_embedding ON decision_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Audit Log indexes
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);

-- ============================================================================
-- Sample Data (Optional - for testing)
-- ============================================================================

-- Insert default admin user (DISABLED - seed via API in production)
-- Uncomment and add password_hash when needed
-- INSERT INTO users (email, full_name, role, active, password_hash) VALUES
--     ('admin@ableka.io', 'Admin User', 'admin', true, 'hashed_password_here')
--     ON CONFLICT DO NOTHING;

-- Insert sample jurisdiction rules
INSERT INTO compliance_rules (jurisdiction, rule_name, rule_category, rule_content, active) VALUES
    ('AE', 'Dubai Fund Minimum Size', 'fund_requirements', '{"minSize": 150000, "currency": "AED"}', true),
    ('AE', 'UAE Enhanced Due Diligence', 'kyc_requirements', '{"docRequirements": ["PASSPORT", "PROOF_ADDRESS", "UAE_ID"], "verificationRequired": true}', true),
    ('IN', 'SEBI Accredited Investor', 'kyc_requirements', '{"minNetWorth": 100000, "currency": "INR", "documentRequired": "PAN_CARD"}', true),
    ('IN', 'RBI Remittance Rules', 'aml_requirements', '{"maxTransferAmount": 250000, "requiresApproval": true}', true),
    ('US', 'Reg D 506c', 'fund_requirements', '{"maxInvestors": 2000, "allowedStates": ["CA", "NY", "TX"]}', true),
    ('US', 'FinCEN AML Requirements', 'aml_requirements', '{"suspeciousActivityReportingRequired": true, "ofacScreeningRequired": true}', true)
    ON CONFLICT DO NOTHING;

-- Insert test users for different jurisdictions
INSERT INTO users (email, full_name, role, jurisdiction, active) VALUES
    ('officer.ae@ableka.io', 'Ahmed Al Maktoum', 'compliance_officer', 'AE', true),
    ('officer.in@ableka.io', 'Rajesh Kumar', 'compliance_officer', 'IN', true),
    ('officer.us@ableka.io', 'John Smith', 'compliance_officer', 'US', true),
    ('analyst@ableka.io', 'Sarah Johnson', 'analyst', NULL, true)
    ON CONFLICT (email) DO NOTHING;

-- Insert test KYC checks (3 records per jurisdiction)
INSERT INTO kyc_checks (entity_id, entity_type, jurisdiction, status, score, flags, recommendations, entity_data) VALUES
    ('entity-ae-001', 'individual', 'AE', 'approved', 95.0, '[]'::jsonb, 'Approved for low-risk investments', '{"name": "Mohammad Al Mazrouei", "nationality": "AE", "accountType": "Individual"}'),
    ('entity-ae-002', 'company', 'AE', 'pending', NULL, '["PENDING_DOCS"]'::jsonb, 'Awaiting proof of address', '{"name": "Dubai Investment Ltd", "registrationNumber": "12345", "jurisdiction": "AE"}'),
    ('entity-ae-003', 'individual', 'AE', 'approved', 88.0, '[]'::jsonb, 'Approved with standard monitoring', '{"name": "Fatima Mohammed', "nationality": "AE", "accountType": "Individual"}'),
    
    ('entity-in-001', 'individual', 'IN', 'approved', 92.0, '[]'::jsonb, 'SEBI accredited investor', '{"name": "Rajesh Sharma", "nationality": "IN", "panCard": "AAAPA1234K"}'),
    ('entity-in-002', 'company', 'IN', 'escalated', 65.0, '["PEP_RISK", "HIGH_VELOCITY"]'::jsonb, 'Requires enhanced due diligence', '{"name": "Bombay Dev Ltd", "cin": "U12345MH2020PTC123456", "jurisdiction": "IN"}'),
    ('entity-in-003', 'individual', 'IN', 'rejected', 45.0, '["SANCTIONS_MATCH", "HIGH_RISK"]'::jsonb, 'Entity flagged in internal watchlist', '{"name": "Unknown Person", "nationality": "IN", "riskLevel": "HIGH"}'),
    
    ('entity-us-001', 'company', 'US', 'approved', 90.0, '[]'::jsonb, 'Accredited entity under Reg D', '{"name": "Silicon Valley Capital LLC", "state": "CA", "registrationNumber": "C12345"}'),
    ('entity-us-002', 'individual', 'US', 'approved', 87.0, '[]'::jsonb, 'Standard KYC verification passed', '{"name": "Jane Doe", "state": "New York", "accountType": "Premium"}'),
    ('entity-us-003', 'fund', 'US', 'pending', NULL, '["DOCS_INCOMPLETE"]'::jsonb, 'Awaiting legal structure documentation', '{"name": "Tech Innovation Fund", "fundType": "Venture Capital", "state": "CA"}')
    ON CONFLICT DO NOTHING;

-- Insert test AML checks (3 records per jurisdiction)
INSERT INTO aml_checks (entity_id, wallet_address, jurisdiction, status, risk_score, risk_level, pep_match, sanctions_match, flags, transaction_history) VALUES
    ('entity-ae-001', '0x1234567890abcdef', 'AE', 'approved', 15.0, 'LOW', false, false, '[]'::jsonb, '{"totalTransactions": 45, "volumeUSD": 250000, "velocity": "normal"}'),
    ('entity-ae-002', '0xabcdef1234567890', 'AE', 'pending', NULL, NULL, false, false, '["PENDING_VERIFICATION"]'::jsonb, '{"totalTransactions": 0, "volumeUSD": 0}'),
    ('entity-ae-003', '0x9876543210fedcba', 'AE', 'approved', 22.0, 'LOW', false, false, '[]'::jsonb, '{"totalTransactions": 120, "volumeUSD": 850000, "velocity": "normal"}'),
    
    ('entity-in-001', '0x1111222233334444', 'IN', 'approved', 18.0, 'LOW', false, false, '[]'::jsonb, '{"totalTransactions": 78, "volumeUSD": 450000, "velocity": "normal"}'),
    ('entity-in-002', '0x5555666677778888', 'IN', 'escalated', 68.0, 'MEDIUM', true, false, '["PEP_MATCH", "VELOCITY_ALERT"]'::jsonb, '{"totalTransactions": 234, "volumeUSD": 2500000, "velocity": "high"}'),
    ('entity-in-003', '0x9999aaaabbbbcccc', 'IN', 'rejected', 92.0, 'CRITICAL', true, true, '["SANCTIONS_MATCH", "PEP_MATCH", "HIGH_RISK_JURISDICTION"]'::jsonb, '{"totalTransactions": 0, "volumeUSD": 0, "flaggedDate": "2026-02-15"}'),
    
    ('entity-us-001', '0xddddeeeeffff0000', 'US', 'approved', 12.0, 'LOW', false, false, '[]'::jsonb, '{"totalTransactions": 156, "volumeUSD": 5600000, "velocity": "normal"}'),
    ('entity-us-002', '0x1111aaaabbbbcccc', 'US', 'approved', 25.0, 'LOW', false, false, '[]'::jsonb, '{"totalTransactions": 89, "volumeUSD": 750000, "velocity": "normal"}'),
    ('entity-us-003', '0x2222ddddeeeeeffff', 'US', 'pending', NULL, NULL, false, false, '["PENDING_CHAINALYSIS"]'::jsonb, '{"totalTransactions": 0, "volumeUSD": 0}')
    ON CONFLICT DO NOTHING;

-- Insert compliance checks (aggregate)
INSERT INTO compliance_checks (entity_id, jurisdiction, overall_status, risk_score, kyc_check_id, aml_check_id, flags, reasoning) VALUES
    ('entity-ae-001', 'AE', 'approved', 15.0, 
     (SELECT id FROM kyc_checks WHERE entity_id = 'entity-ae-001' LIMIT 1),
     (SELECT id FROM aml_checks WHERE entity_id = 'entity-ae-001' LIMIT 1),
     '[]'::jsonb, 'KYC verified and AML clean. Eligible for investment.'),
    
    ('entity-in-002', 'IN', 'escalated', 68.0,
     (SELECT id FROM kyc_checks WHERE entity_id = 'entity-in-002' LIMIT 1),
     (SELECT id FROM aml_checks WHERE entity_id = 'entity-in-002' LIMIT 1),
     '["PEP_MATCH", "HIGH_VELOCITY"]'::jsonb, 'PEP match detected. Enhanced due diligence required.'),
    
    ('entity-in-003', 'IN', 'rejected', 92.0,
     (SELECT id FROM kyc_checks WHERE entity_id = 'entity-in-003' LIMIT 1),
     (SELECT id FROM aml_checks WHERE entity_id = 'entity-in-003' LIMIT 1),
     '["SANCTIONS_MATCH", "PEP_MATCH"]'::jsonb, 'Entity matches OFAC sanctions list. Application rejected.'),
    
    ('entity-us-001', 'US', 'approved', 12.0,
     (SELECT id FROM kyc_checks WHERE entity_id = 'entity-us-001' LIMIT 1),
     (SELECT id FROM aml_checks WHERE entity_id = 'entity-us-001' LIMIT 1),
     '[]'::jsonb, 'Accredited investor. AML screening clear. Ready for fund participation.')
    ON CONFLICT DO NOTHING;

-- ============================================================================
-- Views (Optional - for common queries)
-- ============================================================================

-- Create view for pending approvals
CREATE OR REPLACE VIEW pending_approvals AS
SELECT
    cc.id,
    cc.entity_id,
    cc.jurisdiction,
    cc.overall_status,
    cc.risk_score,
    kc.score as kyc_score,
    ac.risk_score as aml_score,
    cc.created_at
FROM compliance_checks cc
LEFT JOIN kyc_checks kc ON cc.kyc_check_id = kc.id
LEFT JOIN aml_checks ac ON cc.aml_check_id = ac.id
WHERE cc.overall_status = 'pending'
ORDER BY cc.created_at ASC;

-- Create view for high-risk entities
CREATE OR REPLACE VIEW high_risk_entities AS
SELECT
    cc.entity_id,
    cc.jurisdiction,
    cc.risk_score,
    cc.flags,
    ac.sanctions_match,
    ac.pep_match,
    cc.updated_at
FROM compliance_checks cc
LEFT JOIN aml_checks ac ON cc.aml_check_id = ac.id
WHERE cc.risk_score >= 70
   OR ac.sanctions_match = true
   OR ac.pep_match = true
ORDER BY cc.risk_score DESC;

-- ============================================================================
-- Functions (Optional - for common operations)
-- ============================================================================

-- Function to update entity status
CREATE OR REPLACE FUNCTION update_check_status(
    check_id UUID,
    new_status check_status,
    reviewer_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE compliance_checks
    SET overall_status = new_status,
        approved_by = reviewer_id,
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = check_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Security & Permissions (Development Only)
-- ============================================================================

-- Note: In production, implement proper role-based access controls
-- Grant basic permissions for development
GRANT SELECT, INSERT, UPDATE ON kyc_checks TO public;
GRANT SELECT, INSERT, UPDATE ON aml_checks TO public;
GRANT SELECT, INSERT, UPDATE ON compliance_checks TO public;
GRANT SELECT ON compliance_rules TO public;
GRANT INSERT ON audit_logs TO public;

-- ============================================================================
-- Summary
-- ============================================================================
-- Tables created: 7 core tables + 3 views
-- Extensions: pgvector (for ML), uuid-ossp (for UUIDs)
-- Indexes: 15+ for performance
-- Ready for KYC/AML compliance checking
-- Vector embeddings ready for pattern learning
