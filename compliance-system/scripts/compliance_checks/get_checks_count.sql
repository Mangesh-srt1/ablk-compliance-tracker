-- Get compliance checks count with filters
-- Parameters: status (optional), agentType (optional), riskThreshold (optional)
SELECT COUNT(*) as total
FROM compliance.compliance_checks cc
LEFT JOIN compliance.compliance_agents ca ON cc.agent_id = ca.id
WHERE 1=1
  AND ($1::text IS NULL OR cc.status = $1)
  AND ($2::text IS NULL OR ca.agent_type = $2)
  AND ($3::numeric IS NULL OR cc.risk_score >= $3)