-- Get compliance rules
-- Parameters: activeOnly (boolean)
SELECT id, rule_name, rule_type, conditions, actions, priority, is_active, created_at, updated_at
FROM compliance.compliance_rules
WHERE ($1::boolean IS NULL OR is_active = $1)
ORDER BY priority DESC, created_at DESC