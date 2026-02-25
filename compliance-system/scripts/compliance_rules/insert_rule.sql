-- Insert new compliance rule
-- Parameters: ruleName, ruleType, conditions (JSON), actions (JSON), priority, isActive
INSERT INTO compliance.compliance_rules
(rule_name, rule_type, conditions, actions, priority, is_active, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
RETURNING id, rule_name, rule_type, conditions, actions, priority, is_active, created_at, updated_at