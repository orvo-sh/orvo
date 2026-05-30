package observability

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.34.0"

	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/config"
)

const selfTelemetryHeader = "X-Orvo-Self-Telemetry"

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

	traceOptions := []sdktrace.TracerProviderOption{
		sdktrace.WithResource(res),
	}
	var loggerProvider *sdklog.LoggerProvider

	if otelConfig.Endpoint != "" {
		traceExporterOptions := []otlptracehttp.Option{
			otlptracehttp.WithEndpointURL(otlpURL(otelConfig.Endpoint, "/v1/traces")),
		}
		if otelConfig.IngestionKey != "" {
			traceExporterOptions = append(traceExporterOptions, otlptracehttp.WithHeaders(map[string]string{
				"Authorization":     "Bearer " + otelConfig.IngestionKey,
				selfTelemetryHeader: "true",
			}))
		}

		traceExporter, traceExporterErr := otlptracehttp.New(ctx, traceExporterOptions...)
		if traceExporterErr != nil {
			return nil, fmt.Errorf("create otel trace exporter: %w", traceExporterErr)
		}

		traceOptions = append(traceOptions, sdktrace.WithBatcher(traceExporter))

		logExporterOptions := []otlploghttp.Option{
			otlploghttp.WithEndpointURL(otlpURL(otelConfig.Endpoint, "/v1/logs")),
		}
		if otelConfig.IngestionKey != "" {
			logExporterOptions = append(logExporterOptions, otlploghttp.WithHeaders(map[string]string{
				"Authorization":     "Bearer " + otelConfig.IngestionKey,
				selfTelemetryHeader: "true",
			}))
		}

		logExporter, logExporterErr := otlploghttp.New(ctx, logExporterOptions...)
		if logExporterErr != nil {
			return nil, fmt.Errorf("create otel log exporter: %w", logExporterErr)
		}

		loggerProvider = sdklog.NewLoggerProvider(
			sdklog.WithResource(res),
			sdklog.WithProcessor(sdklog.NewBatchProcessor(logExporter)),
		)
		global.SetLoggerProvider(loggerProvider)
	}

	tracerProvider := sdktrace.NewTracerProvider(traceOptions...)
	otel.SetTracerProvider(tracerProvider)
	otel.SetTextMapPropagator(propagation.TraceContext{})

	return func(ctx context.Context) error {
		var shutdownErr error
		if loggerProvider != nil {
			shutdownErr = loggerProvider.Shutdown(ctx)
		}
		if err := tracerProvider.Shutdown(ctx); err != nil && shutdownErr == nil {
			shutdownErr = err
		}
		return shutdownErr
	}, nil
}

func otlpURL(baseURL string, path string) string {
	if strings.HasPrefix(baseURL, "http://") || strings.HasPrefix(baseURL, "https://") {
		parsed, err := url.Parse(baseURL)
		if err == nil {
			parsed.Path = path
			parsed.RawQuery = ""
			parsed.Fragment = ""
			return parsed.String()
		}
	}

	return "http://" + strings.TrimRight(baseURL, "/") + path
}
