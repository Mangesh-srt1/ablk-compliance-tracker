-- Approve compliance check
-- Parameters: checkId, approvedBy, approvalData (JSON)
UPDATE compliance.compliance_checks
SET status = 'completed',
    completed_at = NOW(),
    findings = jsonb_set(COALESCE(findings, '{}'), '{approval}', $3)
WHERE id = $1 AND status IN ('pending', 'processing')
RETURNING id