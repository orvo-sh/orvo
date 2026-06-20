package ingestservice

import (
	"context"
	"log/slog"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	chdb "github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse/db"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/chutil"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

func (service *service) flushLogs(ctx context.Context, batch []models.LogsMessage) error {
	service.logger.Info("flushLogs: flushing logs", slog.Int("batch_count", len(batch)))
	rows := make([]chdb.InsertLogsRawParams, 0)

	for _, message := range batch {
		receivedAt := chutil.NormalizeTime(message.ReceivedAt, time.Now().UTC())
		for _, record := range message.Records {
			timestamp := chutil.NormalizeTime(record.Timestamp, receivedAt)
			observedAt := chutil.NormalizeTime(record.ObservedTimestamp, timestamp)
			expiresAt := computeExpiresAt(timestamp, receivedAt, message.RetentionDays)
			if !expiresAt.After(receivedAt) {
				continue
			}

			rows = append(rows, chdb.InsertLogsRawParams{
				ID:                    util.GenerateID("log"),
				AppID:                 message.AppID,
				IngestionKeyID:        message.IngestionKeyID,
				ReceivedAt:            receivedAt,
				ExpiresAt:             expiresAt,
				Timestamp:             timestamp,
				ObservedTimestamp:     observedAt,
				SeverityNumber:        record.SeverityNumber,
				SeverityText:          record.SeverityText,
				Body:                  record.Body,
				TraceID:               record.TraceID,
				SpanID:                record.SpanID,
				TraceFlags:            record.TraceFlags,
				ResourceAttributes:    chutil.NormalizeStringMap(record.ResourceAttributes),
				ResourceSchemaURL:     record.ResourceSchemaURL,
				ScopeName:             record.ScopeName,
				ScopeVersion:          record.ScopeVersion,
				ScopeAttributes:       chutil.NormalizeStringMap(record.ScopeAttributes),
				ScopeSchemaURL:        record.ScopeSchemaURL,
				LogAttributes:         chutil.NormalizeStringMap(record.LogAttributes),
				ServiceName:           record.ServiceName,
				DeploymentEnvironment: record.DeploymentEnvironment,
			})
		}
	}

	return service.clickhouse.InsertLogsRaw(ctx, rows)
}
