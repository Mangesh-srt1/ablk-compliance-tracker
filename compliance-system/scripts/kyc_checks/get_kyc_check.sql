-- Get KYC check by ID
SELECT
  id,
  entity_id,
  jurisdiction,
  status,
  score,
  flags,
  recommendations,
  documents,
  entity_data,
  processing_time,
  created_at,
  updated_at,
  created_by
FROM kyc_checks
WHERE id = $1;