-- Insert KYC check record
INSERT INTO kyc_checks (
  entity_id,
  jurisdiction,
  status,
  score,
  flags,
  recommendations,
  documents,
  entity_data,
  processing_time,
  created_by
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
) RETURNING id, created_at;