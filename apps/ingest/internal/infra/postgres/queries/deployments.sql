-- name: InsertDeployment :exec
INSERT INTO deployment (
  id,
  app_id,
  service_name,
  environment_name,
  version,
  status,
  started_at,
  finished_at,
  git_sha,
  git_branch,
  git_repository,
  git_actor,
  commit_message,
  external_url,
  metadata
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);

-- name: UpdateDeployment :execrows
UPDATE deployment
SET
  status = COALESCE(sqlc.narg('status')::deployment_status, status),
  finished_at = COALESCE(sqlc.narg('finished_at'), finished_at),
  external_url = COALESCE(sqlc.narg('external_url'), external_url),
  metadata = COALESCE(sqlc.narg('metadata'), metadata)
WHERE id = $1
  AND app_id = $2;
