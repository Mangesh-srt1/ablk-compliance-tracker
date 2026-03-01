/**
 * Database Migration: SAR/CTR Schema Creation
 * Phase 1 Implementation - Creates tables for SARs, CTRs, and audit trails
 * 
 * Run: npm run db:migrate -- --version=001-sar-ctr-tables.sql
 */

-- ═════════════════════════════════════════════════════════════════════════════
-- SAR Reports Table
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sar_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  jurisdiction_code CHAR(2) NOT NULL,
  filing_target VARCHAR(255),
  trigger_type VARCHAR(50) NOT NULL,
  trigger_count INT DEFAULT 0,
  aml_score DECIMAL(5, 2),
  hawala_score DECIMAL(5, 2),
  narrative TEXT,
  transaction_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  filing_id UUID UNIQUE,
  filing_reference VARCHAR(100) UNIQUE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  submitted_by VARCHAR(255),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledgment_number VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  CONSTRAINT sar_status_check CHECK (
    status IN (
      'DRAFT',
      'PENDING_REVIEW',
      'SUBMITTED',
      'ACKNOWLEDGED',
      'ACKNOWLEDGED_WITH_CORRECTION',
      'REJECTED',
      'CLOSED'
    )
  )
);

-- Create indices for SAR reports
CREATE INDEX IF NOT EXISTS idx_sar_entity_id ON sar_reports(entity_id);
CREATE INDEX IF NOT EXISTS idx_sar_jurisdiction ON sar_reports(jurisdiction_code);
CREATE INDEX IF NOT EXISTS idx_sar_status ON sar_reports(status);
CREATE INDEX IF NOT EXISTS idx_sar_filing_id ON sar_reports(filing_id);
CREATE INDEX IF NOT EXISTS idx_sar_submitted_at ON sar_reports(submitted_at);
CREATE INDEX IF NOT EXISTS idx_sar_created_at ON sar_reports(created_at);

-- ═════════════════════════════════════════════════════════════════════════════
-- CTR Reports Table
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ctr_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  entity_name VARCHAR(255),
  entity_type VARCHAR(50),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  threshold_amount NUMERIC(20, 2),
  aggregated_amount NUMERIC(20, 2) NOT NULL,
  transaction_count INT DEFAULT 0,
  transaction_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  narrative TEXT,
  filing_deadline TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  filing_id UUID UNIQUE,
  filing_reference VARCHAR(100) UNIQUE,
  filing_target VARCHAR(100) DEFAULT 'FinCEN',
  submitted_at TIMESTAMP WITH TIME ZONE,
  submitted_by VARCHAR(255),
  ack_number VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  CONSTRAINT ctr_status_check CHECK (
    status IN (
      'DRAFT',
      'PENDING_SUBMISSION',
      'SUBMITTED',
      'ACKNOWLEDGED',
      'FILED',
      'REJECTED',
      'FILED_WITH_CORRECTIONS'
    )
  ),
  CONSTRAINT ctr_currency_check CHECK (currency IN ('USD', 'AED', 'INR', 'SAR', 'EUR'))
);

-- Create indices for CTR reports
CREATE INDEX IF NOT EXISTS idx_ctr_entity_id ON ctr_reports(entity_id);
CREATE INDEX IF NOT EXISTS idx_ctr_currency ON ctr_reports(currency);
CREATE INDEX IF NOT EXISTS idx_ctr_status ON ctr_reports(status);
CREATE INDEX IF NOT EXISTS idx_ctr_filing_deadline ON ctr_reports(filing_deadline);
CREATE INDEX IF NOT EXISTS idx_ctr_filing_id ON ctr_reports(filing_id);
CREATE INDEX IF NOT EXISTS idx_ctr_submitted_at ON ctr_reports(submitted_at);
CREATE INDEX IF NOT EXISTS idx_ctr_created_at ON ctr_reports(created_at);

-- ═════════════════════════════════════════════════════════════════════════════
-- SAR/CTR Filing Audit Table
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sar_ctr_filing_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL,
  report_type VARCHAR(10) NOT NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  change_reason VARCHAR(500),
  changed_by VARCHAR(255),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  filing_id UUID,
  filing_reference VARCHAR(100),
  response_data JSONB,
  CONSTRAINT audit_report_type_check CHECK (report_type IN ('SAR', 'CTR'))
);

-- Create indices for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_report_id ON sar_ctr_filing_audit(report_id);
CREATE INDEX IF NOT EXISTS idx_audit_report_type ON sar_ctr_filing_audit(report_type);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON sar_ctr_filing_audit(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_new_status ON sar_ctr_filing_audit(new_status);

-- ═════════════════════════════════════════════════════════════════════════════
-- SAR/CTR Configuration Table (per jurisdiction)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sar_ctr_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_code CHAR(2) NOT NULL UNIQUE,
  aml_score_threshold DECIMAL(5, 2) DEFAULT 70,
  hawala_score_threshold DECIMAL(5, 2) DEFAULT 80,
  velocity_multiplier DECIMAL(5, 2) DEFAULT 3,
  ctr_amount_threshold NUMERIC(20, 2) DEFAULT 10000,
  ctr_currency CHAR(3) DEFAULT 'USD',
  escalation_days INT DEFAULT 30,
  enable_auto_filing BOOLEAN DEFAULT TRUE,
  enable_auto_submission BOOLEAN DEFAULT FALSE,
  reviewer_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT config_jurisdiction_check CHECK (jurisdiction_code IN ('US', 'AE', 'IN', 'SA', 'EU'))
);

-- Create index for configurations
CREATE INDEX IF NOT EXISTS idx_config_jurisdiction ON sar_ctr_configurations(jurisdiction_code);

-- ═════════════════════════════════════════════════════════════════════════════
-- Insert Default Configurations
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO sar_ctr_configurations (jurisdiction_code, aml_score_threshold, hawala_score_threshold, escalation_days) 
VALUES 
  ('US', 70, 80, 30),
  ('AE', 70, 85, 30),
  ('IN', 70, 80, 30),
  ('SA', 70, 85, 30),
  ('EU', 70, 80, 30)
ON CONFLICT (jurisdiction_code) DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════
-- Trigger Function: Update SAR Report Timestamp
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_sar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sar_timestamp_trigger ON sar_reports;
CREATE TRIGGER sar_timestamp_trigger
BEFORE UPDATE ON sar_reports
FOR EACH ROW
EXECUTE FUNCTION update_sar_timestamp();

-- ═════════════════════════════════════════════════════════════════════════════
-- Trigger Function: Update CTR Report Timestamp
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_ctr_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ctr_timestamp_trigger ON ctr_reports;
CREATE TRIGGER ctr_timestamp_trigger
BEFORE UPDATE ON ctr_reports
FOR EACH ROW
EXECUTE FUNCTION update_ctr_timestamp();

-- ═════════════════════════════════════════════════════════════════════════════
-- Trigger Function: Auto-create Audit Log Entry on SAR Status Change
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION audit_sar_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO sar_ctr_filing_audit (
      report_id,
      report_type,
      previous_status,
      new_status,
      change_reason,
      changed_by,
      filing_id,
      filing_reference
    ) VALUES (
      NEW.id,
      'SAR',
      OLD.status,
      NEW.status,
      'Status change',
      COALESCE(NEW.submitted_by, 'system'),
      NEW.filing_id,
      NEW.filing_reference
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sar_audit_trigger ON sar_reports;
CREATE TRIGGER sar_audit_trigger
AFTER UPDATE ON sar_reports
FOR EACH ROW
EXECUTE FUNCTION audit_sar_status_change();

-- ═════════════════════════════════════════════════════════════════════════════
-- Trigger Function: Auto-create Audit Log Entry on CTR Status Change
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION audit_ctr_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO sar_ctr_filing_audit (
      report_id,
      report_type,
      previous_status,
      new_status,
      change_reason,
      changed_by,
      filing_id,
      filing_reference
    ) VALUES (
      NEW.id,
      'CTR',
      OLD.status,
      NEW.status,
      'Status change',
      COALESCE(NEW.submitted_by, 'system'),
      NEW.filing_id,
      NEW.filing_reference
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ctr_audit_trigger ON ctr_reports;
CREATE TRIGGER ctr_audit_trigger
AFTER UPDATE ON ctr_reports
FOR EACH ROW
EXECUTE FUNCTION audit_ctr_status_change();

-- ═════════════════════════════════════════════════════════════════════════════
-- Verification Queries (for testing)
-- ═════════════════════════════════════════════════════════════════════════════

-- SELECT table_name FROM information_schema.tables 
--   WHERE table_schema = 'public' 
--   AND table_name IN ('sar_reports', 'ctr_reports', 'sar_ctr_filing_audit', 'sar_ctr_configurations');

-- SELECT COUNT(*) as default_configs FROM sar_ctr_configurations;
