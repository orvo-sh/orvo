package ingestservice

import (
	"context"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	chdb "github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse/db"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/chutil"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

func (service *service) flushTraces(ctx context.Context, batch []models.TracesMessage) error {
	rows := make([]chdb.InsertTracesRawParams, 0)

	for _, message := range batch {
		receivedAt := chutil.NormalizeTime(message.ReceivedAt, time.Now().UTC())
		for _, span := range message.Spans {
			startTime := chutil.NormalizeTime(span.StartTime, receivedAt)
			endTime := chutil.NormalizeTime(span.EndTime, startTime)
			expiresAt := computeExpiresAt(startTime, receivedAt, message.RetentionDays)
			if !expiresAt.After(receivedAt) {
				continue
			}

			rows = append(rows, chdb.InsertTracesRawParams{
				ID:                    util.GenerateID("trc"),
				AppID:                 message.AppID,
				IngestionKeyID:        message.IngestionKeyID,
				ReceivedAt:            receivedAt,
				ExpiresAt:             expiresAt,
				TraceID:               span.TraceID,
				SpanID:                span.SpanID,
				ParentSpanID:          span.ParentSpanID,
				TraceState:            span.TraceState,
				Name:                  span.Name,
				Kind:                  span.Kind,
				StartTime:             startTime,
				EndTime:               endTime,
				DurationNs:            span.DurationNs,
				StatusCode:            span.StatusCode,
				StatusMessage:         span.StatusMessage,
				ResourceAttributes:    chutil.NormalizeStringMap(span.ResourceAttributes),
				ScopeAttributes:       chutil.NormalizeStringMap(span.ScopeAttributes),
				SpanAttributes:        chutil.NormalizeStringMap(span.SpanAttributes),
				ResourceSchemaURL:     span.ResourceSchemaURL,
				ScopeName:             span.ScopeName,
				ScopeVersion:          span.ScopeVersion,
				ScopeSchemaURL:        span.ScopeSchemaURL,
				EventsJSON:            chutil.MarshalJSON(span.Events, "[]"),
				LinksJSON:             chutil.MarshalJSON(span.Links, "[]"),
				ServiceName:           span.ServiceName,
				DeploymentEnvironment: span.DeploymentEnvironment,
			})
		}
	}

	return service.clickhouse.InsertTracesRaw(ctx, rows)
}
