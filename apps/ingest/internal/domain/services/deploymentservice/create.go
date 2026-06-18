package deploymentservice

import (
	"context"
	"log/slog"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	pgdb "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres/db"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/pgutil"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

func (service *service) Create(ctx context.Context, appID string, input CreateInput) (string, apperr.Error) {
	service.logger.InfoContext(ctx, "Create: creating deployment", slog.String("app_id", appID))

	id := util.GenerateID("dep")

	if err := service.postgres.Queries().InsertDeployment(ctx, pgdb.InsertDeploymentParams{
		ID:              id,
		AppID:           appID,
		ServiceName:     input.ServiceName,
		EnvironmentName: input.EnvironmentName,
		Version:         pgutil.TextFromPtr(input.Version),
		Status:          pgdb.DeploymentStatus(input.Status),
		StartedAt:       pgutil.Timestamp(input.StartedAt),
		FinishedAt:      pgutil.TimestampFromPtr(input.FinishedAt),
		GitSha:          pgutil.TextFromPtr(input.GitSHA),
		GitBranch:       pgutil.TextFromPtr(input.GitBranch),
		GitRepository:   pgutil.TextFromPtr(input.GitRepository),
		GitActor:        pgutil.TextFromPtr(input.GitActor),
		CommitMessage:   pgutil.TextFromPtr(input.CommitMessage),
		ExternalUrl:     pgutil.TextFromPtr(input.ExternalURL),
		Metadata:        pgutil.JSONB(input.Metadata),
	}); err != nil {
		service.logger.ErrorContext(ctx, "Create: failed to insert deployment", "error", err)
		return "", errs.ErrInternal
	}

	if err := service.postgres.Queries().MarkAppDeploymentsFirstReceived(ctx, appID); err != nil {
		service.logger.ErrorContext(ctx, "Create: failed to update first received timestamp", "error", err)
		return "", errs.ErrInternal
	}

	return id, nil
}
