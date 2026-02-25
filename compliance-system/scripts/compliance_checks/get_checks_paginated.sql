-- Get compliance checks with pagination and filters
-- Parameters: status (optional), agentType (optional), riskThreshold (optional), limit, offset
SELECT
  cc.id,
  cc.transaction_id,
  cc.check_type,
  cc.status,
  cc.risk_score,
  cc.findings,
  cc.agent_id,
  cc.created_at,
  cc.completed_at,
  cc.requested_by,
  ca.name as agent_name,
  ca.agent_type
FROM compliance.compliance_checks cc
LEFT JOIN compliance.compliance_agents ca ON cc.agent_id = ca.id
WHERE 1=1
  AND ($1::text IS NULL OR cc.status = $1)
  AND ($2::text IS NULL OR ca.agent_type = $2)
  AND ($3::numeric IS NULL OR cc.risk_score >= $3)
ORDER BY cc.created_at DESC
LIMIT $4 OFFSET $5