package deploymentservice

import (
	"context"
	"log/slog"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	pgdb "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres/db"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/pgutil"
)

func (service *service) Update(ctx context.Context, appID string, deploymentID string, input UpdateInput) apperr.Error {
	service.logger.InfoContext(ctx, "Update: updating deployment",
		slog.String("app_id", appID),
		slog.String("deployment_id", deploymentID),
	)

	status := pgdb.NullDeploymentStatus{Valid: false}
	if input.Status != nil {
		status = pgdb.NullDeploymentStatus{
			DeploymentStatus: pgdb.DeploymentStatus(*input.Status),
			Valid:            true,
		}
	}

	rowsAffected, err := service.postgres.Queries().UpdateDeployment(ctx, pgdb.UpdateDeploymentParams{
		ID:          deploymentID,
		AppID:       appID,
		Status:      status,
		FinishedAt:  pgutil.TimestampFromPtr(input.FinishedAt),
		ExternalUrl: pgutil.TextFromPtr(input.ExternalURL),
		Metadata:    input.Metadata,
	})
	if err != nil {
		service.logger.ErrorContext(ctx, "Update: failed to update deployment", "error", err)
		return errs.ErrInternal
	}
	if rowsAffected == 0 {
		return errs.ErrDeploymentNotFound
	}

	return nil
}
