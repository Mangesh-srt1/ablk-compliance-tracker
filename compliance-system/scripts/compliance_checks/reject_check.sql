-- Reject compliance check
-- Parameters: checkId, rejectedBy, reason, rejectionData (JSON)
UPDATE compliance.compliance_checks
SET status = 'escalated',
    completed_at = NOW(),
    findings = jsonb_set(COALESCE(findings, '{}'), '{rejection}', $4)
WHERE id = $1 AND status IN ('pending', 'processing')
RETURNING id