-- Get active agent by type
-- Parameters: agentType, status
SELECT id FROM compliance.compliance_agents WHERE agent_type = $1 AND status = $2 LIMIT 1