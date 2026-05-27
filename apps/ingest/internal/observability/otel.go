package observability

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.34.0"

	"github.com/orvo-sh/orvo/apps/ingest/internal/config"
)

func SetupOTel(ctx context.Context, appConfig config.AppConfig, otelConfig config.OtelConfig) (func(context.Context) error, error) {
	res, err := resource.New(
		ctx,
		resource.WithAttributes(
			semconv.ServiceName(config.ServiceName),
			semconv.DeploymentEnvironmentName(appConfig.Environment),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("create otel resource: %w", err)
	}

	options := []sdktrace.TracerProviderOption{
		sdktrace.WithResource(res),
	}

	if otelConfig.Endpoint != "" {
		exporterOptions := []otlptracehttp.Option{
			otlptracehttp.WithEndpoint(otelConfig.Endpoint),
		}
		if otelConfig.Insecure {
			exporterOptions = append(exporterOptions, otlptracehttp.WithInsecure())
		}
		if otelConfig.IngestionKey != "" {
			exporterOptions = append(exporterOptions, otlptracehttp.WithHeaders(map[string]string{
				"Authorization": "Bearer " + otelConfig.IngestionKey,
			}))
		}

		exporter, exporterErr := otlptracehttp.New(ctx, exporterOptions...)
		if exporterErr != nil {
			return nil, fmt.Errorf("create otel exporter: %w", exporterErr)
		}

		options = append(options, sdktrace.WithBatcher(exporter))
	}

	tracerProvider := sdktrace.NewTracerProvider(options...)
	otel.SetTracerProvider(tracerProvider)
	otel.SetTextMapPropagator(propagation.TraceContext{})

	return tracerProvider.Shutdown, nil
}
