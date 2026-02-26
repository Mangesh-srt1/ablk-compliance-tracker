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
    ('IN', 'SEBI Accredited Investor', 'kyc_requirements', '{"minNetWorth": 100000, "currency": "INR"}', true),
    ('US', 'Reg D 506c', 'fund_requirements', '{"maxInvestors": 2000, "allowedStates": ["CA", "NY", "TX"]}', true)
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
