-- Insert new compliance check
-- Parameters: transactionId, checkType, agentId, requestedBy
INSERT INTO compliance.compliance_checks
(transaction_id, check_type, status, agent_id, requested_by, created_at)
VALUES ($1, $2, 'pending', $3, $4, NOW())
RETURNING id, transaction_id, check_type, status, agent_id, created_at, requested_by