-- Insert AML check record
INSERT INTO aml_checks (
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
  created_by
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
) RETURNING id, created_at;