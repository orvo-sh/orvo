-- name: GetActiveIngestionKeyByKey :one
SELECT
  ingestion_key.id AS ingestion_key_id,
  app.organization_id,
  ingestion_key.app_id
FROM ingestion_key
JOIN app ON app.id = ingestion_key.app_id
WHERE ingestion_key.key = $1
  AND ingestion_key.revoked_at IS NULL;

-- name: TouchIngestionKeyLastUsed :exec
UPDATE ingestion_key
SET last_used_at = NOW()
WHERE id = $1;
