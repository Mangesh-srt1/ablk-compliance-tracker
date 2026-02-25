-- Get AML check by ID
SELECT
  id,
  entity_id,
  jurisdiction,
  score,
  risk_level,
  flags,
  recommendations,
  transactions,
  entity_data,
  screening_results,
  processing_time,
  created_at,
  updated_at,
  created_by
FROM aml_checks
WHERE id = $1;