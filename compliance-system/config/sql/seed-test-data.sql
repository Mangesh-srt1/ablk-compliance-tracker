-- Comprehensive Test Data Seeding Script
-- Purpose: Populate database with realistic test data for development/QA
-- Created: 2026-02-27 (Monday Mar 3 Implementation)
-- Note: Data uses realistic entity names and scenarios per jurisdiction

-- JURISDICTION DATA (Reference)
-- All test entities organized by jurisdiction for compliance rules testing

-- ============================================================================
-- SECTION 1: UAE (AE) - DUBAI JURISDICTION TEST DATA
-- ============================================================================

-- Test Case 1: AE-001 (Clean Individual - Low Risk)
INSERT INTO kyc_checks (entity_id, entity_type, jurisdiction, status, score, flags, recommendations, entity_data)
VALUES ('ae-ind-clean-001', 'individual', 'AE', 'approved', 95.0, '[]'::jsonb, 
        'Clean KYC. Eligible for all investment products.',
        '{"name": "Mohammad Ahmed Al Mazrouei", "nationality": "AE", "dob": "1975-03-15", "accountType": "Premium", "documentType": "EMIRATES_ID"}')
ON CONFLICT DO NOTHING;

INSERT INTO aml_checks (entity_id, wallet_address, jurisdiction, status, risk_score, risk_level, pep_match, sanctions_match, flags, transaction_history)
VALUES ('ae-ind-clean-001', '0xaaaa1111bbbb2222cccc3333dddd4444eeee5555', 'AE', 'approved', 10.0, 'LOW', false, false, '[]'::jsonb,
        '{"totalTransactions": 45, "volumeUSD": 250000, "velocity": "normal", "monthlyAvg": 18532}')
ON CONFLICT DO NOTHING;

-- Test Case 2: AE-002 (Company - Pending Verification)
INSERT INTO kyc_checks (entity_id, entity_type, jurisdiction, status, score, flags, recommendations, entity_data)
VALUES ('ae-corp-pending-002', 'company', 'AE', 'pending', NULL, '["DOCS_INCOMPLETE"]'::jsonb,
        'Awaiting certificate of incorporation and board resolution.',
        '{"name": "Dubai Luxury Investments Ltd", "registrationNumber": "DLC-123456", "jurisdiction": "AE", "sector": "Finance"}')
ON CONFLICT DO NOTHING;

INSERT INTO aml_checks (entity_id, wallet_address, jurisdiction, status, risk_score, risk_level, pep_match, sanctions_match, flags, transaction_history)
VALUES ('ae-corp-pending-002', '0xbbbb2222cccc3333dddd4444eeee5555ffff6666', 'AE', 'pending', NULL, NULL, false, false, '["DOCS_PENDING"]'::jsonb,
        '{"totalTransactions": 0, "volumeUSD": 0, "entityNew": true}')
ON CONFLICT DO NOTHING;

-- Test Case 3: AE-003 (Individual - High-Risk Sanctions Flag)
INSERT INTO kyc_checks (entity_id, entity_type, jurisdiction, status, score, flags, recommendations, entity_data)
VALUES ('ae-ind-flagged-003', 'individual', 'AE', 'rejected', 25.0, '["SANCTIONS_MATCH"]'::jsonb,
        'Entity matches international sanctions list. Rejected.',
        '{"name": "Unknown Beneficial Owner", "nationality": "AE", "riskLevel": "CRITICAL", "flagDate": "2026-02-20"}')
ON CONFLICT DO NOTHING;

INSERT INTO aml_checks (entity_id, wallet_address, jurisdiction, status, risk_score, risk_level, pep_match, sanctions_match, flags, transaction_history)
VALUES ('ae-ind-flagged-003', '0xcccc3333dddd4444eeee5555ffff6666aaaa7777', 'AE', 'rejected', 95.0, 'CRITICAL', false, true, '["SANCTIONS_MATCH", "DO_NOT_ROUTE"]'::jsonb,
        '{"totalTransactions": 0, "volumeUSD": 0, "flaggedDate": "2026-02-15", "source": "OFAC_SDN"}')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 2: INDIA (IN) - SEBI JURISDICTION TEST DATA
-- ============================================================================

-- Test Case 1: IN-001 (Accredited Individual - SEBI Compliant)
INSERT INTO kyc_checks (entity_id, entity_type, jurisdiction, status, score, flags, recommendations, entity_data)
VALUES ('in-ind-accredited-001', 'individual', 'IN', 'approved', 92.0, '[]'::jsonb,
        'SEBI accredited investor. Verified net worth exceeds threshold.',
        '{"name": "Rajesh Vikram Sharma", "nationality": "IN", "panCard": "AAARA1234K", "minNetWorth": 2500000, "currency": "INR"}')
ON CONFLICT DO NOTHING;

INSERT INTO aml_checks (entity_id, wallet_address, jurisdiction, status, risk_score, risk_level, pep_match, sanctions_match, flags, transaction_history)
VALUES ('in-ind-accredited-001', '0xdddd4444eeee5555ffff6666aaaa7777bbbb8888', 'IN', 'approved', 18.0, 'LOW', false, false, '[]'::jsonb,
        '{"totalTransactions": 78, "volumeUSD": 450000, "velocity": "normal", "monthlyAvg": 32000}')
ON CONFLICT DO NOTHING;

-- Test Case 2: IN-002 (Company - PEP Risk & High Velocity)
INSERT INTO kyc_checks (entity_id, entity_type, jurisdiction, status, score, flags, recommendations, entity_data)
VALUES ('in-corp-pep-002', 'company', 'IN', 'escalated', 65.0, '["PEP_RISK"]'::jsonb,
        'Beneficial owner identified as Politically Exposed Person. Enhanced due diligence required.',
        '{"name": "Bombay Investment Trust Pvt Ltd", "cin": "U65111MH2019PTC123456", "jurisdiction": "IN", "beneficialOwner": "Senior Government Official"}')
ON CONFLICT DO NOTHING;

INSERT INTO aml_checks (entity_id, wallet_address, jurisdiction, status, risk_score, risk_level, pep_match, sanctions_match, flags, transaction_history)
VALUES ('in-corp-pep-002', '0xeeee5555ffff6666aaaa7777bbbb8888cccc9999', 'IN', 'escalated', 68.0, 'MEDIUM', true, false, '["PEP_MATCH", "VELOCITY_ALERT"]'::jsonb,
        '{"totalTransactions": 234, "volumeUSD": 2500000, "velocity": "high", "monthlyAvg": 285714, "spikeDates": ["2026-02-10", "2026-02-15"]}')
ON CONFLICT DO NOTHING;

-- Test Case 3: IN-003 (Individual - Multiple Red Flags - Rejected)
INSERT INTO kyc_checks (entity_id, entity_type, jurisdiction, status, score, flags, recommendations, entity_data)
VALUES ('in-ind-rejected-003', 'individual', 'IN', 'rejected', 45.0, '["SANCTIONS_MATCH", "HIGH_RISK_JURISDICTION"]'::jsonb,
        'Multiple compliance risks detected. Rejected for all investment products.',
        '{"name": "Unknown Entity", "nationality": "IN", "riskLevel": "CRITICAL", "incidentCount": 3}')
ON CONFLICT DO NOTHING;

INSERT INTO aml_checks (entity_id, wallet_address, jurisdiction, status, risk_score, risk_level, pep_match, sanctions_match, flags, transaction_history)
VALUES ('in-ind-rejected-003', '0xffff6666aaaa7777bbbb8888cccc9999dddd0000', 'IN', 'rejected', 92.0, 'CRITICAL', true, true, '["SANCTIONS_MATCH", "PEP_MATCH", "STRUCTURED_TRANSACTIONS"]'::jsonb,
        '{"totalTransactions": 0, "volumeUSD": 0, "flaggedDate": "2026-02-15", "source": "UN_SECURITY_COUNCIL"}')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 3: UNITED STATES (US) - REG D JURISDICTION TEST DATA
-- ============================================================================

-- Test Case 1: US-001 (Accredited Company - Clean)
INSERT INTO kyc_checks (entity_id, entity_type, jurisdiction, status, score, flags, recommendations, entity_data)
VALUES ('us-corp-accredited-001', 'company', 'US', 'approved', 90.0, '[]'::jsonb,
        'Accredited entity under SEC Reg D 506c. All documentation verified.',
        '{"name": "Silicon Valley Capital Management LLC", "state": "CA", "ein": "12-3456789", "accreditationLevel": "INSTITUTIONAL"}')
ON CONFLICT DO NOTHING;

INSERT INTO aml_checks (entity_id, wallet_address, jurisdiction, status, risk_score, risk_level, pep_match, sanctions_match, flags, transaction_history)
VALUES ('us-corp-accredited-001', '0xaaaa7777bbbb8888cccc9999dddd0000eeee1111', 'US', 'approved', 12.0, 'LOW', false, false, '[]'::jsonb,
        '{"totalTransactions": 156, "volumeUSD": 5600000, "velocity": "normal", "monthlyAvg": 467000, "liabilities": []}')
ON CONFLICT DO NOTHING;

-- Test Case 2: US-002 (Individual - Standard Verification)
INSERT INTO kyc_checks (entity_id, entity_type, jurisdiction, status, score, flags, recommendations, entity_data)
VALUES ('us-ind-standard-002', 'individual', 'US', 'approved', 87.0, '[]'::jsonb,
        'Standard KYC verification passed. Eligible for Reg D offerings.',
        '{"name": "Jane Elizabeth Doe", "state": "NY", "ssn_last4": "1234", "accountType": "Premium", "verificationDate": "2026-02-10"}')
ON CONFLICT DO NOTHING;

INSERT INTO aml_checks (entity_id, wallet_address, jurisdiction, status, risk_score, risk_level, pep_match, sanctions_match, flags, transaction_history)
VALUES ('us-ind-standard-002', '0xbbbb8888cccc9999dddd0000eeee1111ffff2222', 'US', 'approved', 25.0, 'LOW', false, false, '[]'::jsonb,
        '{"totalTransactions": 89, "volumeUSD": 750000, "velocity": "normal", "monthlyAvg": 54545}')
ON CONFLICT DO NOTHING;

-- Test Case 3: US-003 (Fund Entity - Pending Documentation)
INSERT INTO kyc_checks (entity_id, entity_type, jurisdiction, status, score, flags, recommendations, entity_data)
VALUES ('us-fund-pending-003', 'fund', 'US', 'pending', NULL, '["DOCS_INCOMPLETE"]'::jsonb,
        'Awaiting Form ADV and fund legal documentation. Estimated review: 2 weeks.',
        '{"name": "Tech Innovation Growth Fund LP", "state": "CA", "fundType": "Venture Capital", "targetRaise": 50000000}')
ON CONFLICT DO NOTHING;

INSERT INTO aml_checks (entity_id, wallet_address, jurisdiction, status, risk_score, risk_level, pep_match, sanctions_match, flags, transaction_history)
VALUES ('us-fund-pending-003', '0xcccc9999dddd0000eeee1111ffff2222aaaa3333', 'US', 'pending', NULL, NULL, false, false, '["PENDING_CHAINALYSIS"]'::jsonb,
        '{"totalTransactions": 0, "volumeUSD": 0, "fundNew": true, "requiresChainalysis": true}')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 4: COMPLIANCE AGGREGATION RECORDS
-- ============================================================================

-- Aggregate for AE-001 (Clean Individual)
INSERT INTO compliance_checks (entity_id, jurisdiction, overall_status, risk_score, kyc_check_id, aml_check_id, flags, reasoning, created_at)
VALUES ('ae-ind-clean-001', 'AE', 'approved', 10.0,
        (SELECT id FROM kyc_checks WHERE entity_id = 'ae-ind-clean-001' LIMIT 1),
        (SELECT id FROM aml_checks WHERE entity_id = 'ae-ind-clean-001' LIMIT 1),
        '[]'::jsonb,
        'All KYC documentation verified. AML screening clean. Entity cleared for investment participation.',
        CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- Aggregate for IN-002 (PEP Risk)
INSERT INTO compliance_checks (entity_id, jurisdiction, overall_status, risk_score, kyc_check_id, aml_check_id, flags, reasoning, created_at)
VALUES ('in-corp-pep-002', 'IN', 'escalated', 68.0,
        (SELECT id FROM kyc_checks WHERE entity_id = 'in-corp-pep-002' LIMIT 1),
        (SELECT id FROM aml_checks WHERE entity_id = 'in-corp-pep-002' LIMIT 1),
        '["PEP_MATCH", "HIGH_VELOCITY"]'::jsonb,
        'Beneficial owner identified as PEP. Combined AML risk score (68) triggers escalation. Enhanced due diligence team review required. High transaction velocity flagged.',
        CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- Aggregate for US-001 (Approved)
INSERT INTO compliance_checks (entity_id, jurisdiction, overall_status, risk_score, kyc_check_id, aml_check_id, flags, reasoning, created_at)
VALUES ('us-corp-accredited-001', 'US', 'approved', 12.0,
        (SELECT id FROM kyc_checks WHERE entity_id = 'us-corp-accredited-001' LIMIT 1),
        (SELECT id FROM aml_checks WHERE entity_id = 'us-corp-accredited-001' LIMIT 1),
        '[]'::jsonb,
        'Accredited institutional investor. SEC Reg D 506c compliant. AML risk score low (12). Entity approved for all offerings.',
        CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 5: AUDIT LOG ENTRIES
-- ============================================================================

INSERT INTO audit_logs (entity_id, action, status, reason, created_by)
VALUES 
    ('ae-ind-clean-001', 'KYC_APPROVED', 'approved', 'All documents verified and clean', 'system'),
    ('ae-ind-clean-001', 'AML_APPROVED', 'approved', 'Chainalysis screening clear', 'system'),
    ('in-corp-pep-002', 'PEP_FLAGGED', 'escalated', 'Beneficial owner identified in PEP database', 'aml_team'),
    ('in-corp-pep-002', 'ESCALATED_FOR_REVIEW', 'escalated', 'Enhanced due diligence team assigned', 'compliance_officer'),
    ('us-corp-accredited-001', 'KYC_APPROVED', 'approved', 'SEC accreditation verified', 'system'),
    ('us-fund-pending-003', 'SUBMISSION_RECEIVED', 'pending', 'Form ADV and legal docs pending', 'api_gateway')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 6: VERIFICATION QUERIES
-- ============================================================================
-- Uncomment and run these queries to verify data integrity

-- VERIFICATION 1: Count test records by jurisdiction
/*
SELECT 
  'kyc_checks' as table_name,
  jurisdiction,
  COUNT(*) as record_count,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
  COUNT(CASE WHEN status = 'escalated' THEN 1 END) as escalated
FROM kyc_checks
WHERE entity_id LIKE '%ae-%' OR entity_id LIKE '%in-%' OR entity_id LIKE '%us-%'
GROUP BY jurisdiction
ORDER BY jurisdiction;
*/

-- VERIFICATION 2: Risk score distribution
/*
SELECT
  CASE 
    WHEN risk_score < 30 THEN 'LOW'
    WHEN risk_score < 60 THEN 'MEDIUM'
    WHEN risk_score < 85 THEN 'HIGH'
    ELSE 'CRITICAL'
  END as risk_category,
  COUNT(*) as count,
  AVG(risk_score) as avg_score,
  MIN(risk_score) as min_score,
  MAX(risk_score) as max_score
FROM aml_checks
WHERE entity_id LIKE '%ae-%' OR entity_id LIKE '%in-%' OR entity_id LIKE '%us-%'
GROUP BY risk_category
ORDER BY avg_score DESC;
*/

-- VERIFICATION 3: Pending approvals by jurisdiction
/*
SELECT
  jurisdiction,
  COUNT(*) as pending_count,
  STRING_AGG(entity_id, ', ') as entity_ids
FROM kyc_checks
WHERE status = 'pending'
GROUP BY jurisdiction;
*/

-- VERIFICATION 4: Compliance check aggregate summary
/*
SELECT
  overall_status,
  COUNT(*) as count,
  AVG(risk_score) as avg_risk,
  MIN(risk_score) as min_risk,
  MAX(risk_score) as max_risk,
  ARRAY_AGG(DISTINCT entity_id) as entities
FROM compliance_checks
GROUP BY overall_status
ORDER BY avg_risk DESC;
*/
