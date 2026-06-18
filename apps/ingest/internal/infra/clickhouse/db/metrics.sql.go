package chdb

import (
	"context"
	"fmt"
)

const insertMetricsRaw = `
INSERT INTO metrics_raw (
  id,
  app_id,
  ingestion_key_id,
  received_at,
  expires_at,
  entity_kind,
  host_id,
  host_name,
  host_arch,
  os_type,
  container_id,
  container_name,
  container_image_name,
  metric_name,
  metric_type,
  metric_unit,
  description,
  service_name,
  deployment_environment,
  resource_attributes,
  scope_name,
  scope_version,
  attributes,
  start_time,
  time,
  value_int,
  value_double,
  aggregation_temporality,
  is_monotonic,
  histogram_count,
  histogram_sum,
  histogram_min,
  histogram_max,
  histogram_bucket_counts,
  histogram_explicit_bounds,
  exemplars_json,
  flags
)
`

func (q *Queries) InsertMetricsRaw(ctx context.Context, arg []InsertMetricsRawParams) error {
	if len(arg) == 0 {
		return nil
	}

	batch, err := q.db.PrepareBatch(ctx, insertMetricsRaw)
	if err != nil {
		return fmt.Errorf("clickhouse: prepare metrics batch: %w", err)
	}

	for _, params := range arg {
		if err := batch.Append(
			params.ID,
			params.AppID,
			params.IngestionKeyID,
			params.ReceivedAt,
			params.ExpiresAt,
			params.EntityKind,
			params.HostID,
			params.HostName,
			params.HostArch,
			params.OSType,
			params.ContainerID,
			params.ContainerName,
			params.ContainerImageName,
			params.MetricName,
			params.MetricType,
			params.MetricUnit,
			params.Description,
			params.ServiceName,
			params.DeploymentEnvironment,
			params.ResourceAttributes,
			params.ScopeName,
			params.ScopeVersion,
			params.Attributes,
			params.StartTime,
			params.Time,
			params.ValueInt,
			params.ValueDouble,
			params.AggregationTemporality,
			params.IsMonotonic,
			params.HistogramCount,
			params.HistogramSum,
			params.HistogramMin,
			params.HistogramMax,
			params.HistogramBucketCounts,
			params.HistogramExplicitBounds,
			params.ExemplarsJSON,
			params.Flags,
		); err != nil {
			return fmt.Errorf("clickhouse: append metric row: %w", err)
		}
	}

	if err := batch.Send(); err != nil {
		return fmt.Errorf("clickhouse: send metrics batch: %w", err)
	}

	return nil
}
