package otel

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
)

const SelfTelemetryHeader = "X-Orvo-Self-Telemetry"

type Config struct {
	ServiceName  string
	Environment  string
	Endpoint     string
	IngestionKey string
}

type selfTelemetryContextKey struct{}

func Init(ctx context.Context, config Config) (func(context.Context) error, error) {
	resource, err := resource.New(
		ctx,
		resource.WithAttributes(
			semconv.ServiceName(config.ServiceName),
			semconv.DeploymentEnvironmentName(config.Environment),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("create otel resource: %w", err)
	}

	traceOptions := []sdktrace.TracerProviderOption{
		sdktrace.WithResource(resource),
		sdktrace.WithSampler(selfTelemetrySampler{delegate: sdktrace.ParentBased(sdktrace.AlwaysSample())}),
	}

	var loggerProvider *sdklog.LoggerProvider

	if config.Endpoint != "" {
		traceExporterOptions := []otlptracehttp.Option{
			otlptracehttp.WithEndpointURL(otlpURL(config.Endpoint, "/v1/traces")),
		}
		if config.IngestionKey != "" {
			traceExporterOptions = append(traceExporterOptions, otlptracehttp.WithHeaders(map[string]string{
				"Authorization":     "Bearer " + config.IngestionKey,
				SelfTelemetryHeader: "true",
			}))
		}

		traceExporter, err := otlptracehttp.New(ctx, traceExporterOptions...)
		if err != nil {
			return nil, fmt.Errorf("create otel trace exporter: %w", err)
		}
		traceOptions = append(traceOptions, sdktrace.WithBatcher(traceExporter))

		logExporterOptions := []otlploghttp.Option{
			otlploghttp.WithEndpointURL(otlpURL(config.Endpoint, "/v1/logs")),
		}
		if config.IngestionKey != "" {
			logExporterOptions = append(logExporterOptions, otlploghttp.WithHeaders(map[string]string{
				"Authorization":     "Bearer " + config.IngestionKey,
				SelfTelemetryHeader: "true",
			}))
		}

		logExporter, err := otlploghttp.New(ctx, logExporterOptions...)
		if err != nil {
			return nil, fmt.Errorf("create otel log exporter: %w", err)
		}

		loggerProvider = sdklog.NewLoggerProvider(
			sdklog.WithResource(resource),
			sdklog.WithProcessor(selfTelemetryLogProcessor{
				Processor: sdklog.NewBatchProcessor(logExporter),
			}),
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

func WithSelfTelemetry(ctx context.Context) context.Context {
	return context.WithValue(ctx, selfTelemetryContextKey{}, true)
}

func IsSelfTelemetry(ctx context.Context) bool {
	value, ok := ctx.Value(selfTelemetryContextKey{}).(bool)
	return ok && value
}

type selfTelemetrySampler struct {
	delegate sdktrace.Sampler
}

func (sampler selfTelemetrySampler) ShouldSample(parameters sdktrace.SamplingParameters) sdktrace.SamplingResult {
	if IsSelfTelemetry(parameters.ParentContext) {
		return sdktrace.SamplingResult{Decision: sdktrace.Drop}
	}
	return sampler.delegate.ShouldSample(parameters)
}

func (sampler selfTelemetrySampler) Description() string {
	return "SelfTelemetryFilter{" + sampler.delegate.Description() + "}"
}

type selfTelemetryLogProcessor struct {
	sdklog.Processor
}

func (processor selfTelemetryLogProcessor) Enabled(ctx context.Context, parameters sdklog.EnabledParameters) bool {
	return !IsSelfTelemetry(ctx) && processor.Processor.Enabled(ctx, parameters)
}

func (processor selfTelemetryLogProcessor) OnEmit(ctx context.Context, record *sdklog.Record) error {
	if IsSelfTelemetry(ctx) {
		return nil
	}
	return processor.Processor.OnEmit(ctx, record)
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
