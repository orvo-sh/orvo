import { tracing } from "@opentelemetry/sdk-node";

// Retain usage spans even when their parent HTTP span was sampled out. Keep
// the standard OTEL_TRACES_SAMPLER choice for all other self-telemetry.
const createSelfTelemetrySampler = () => {
  const name = process.env.OTEL_TRACES_SAMPLER ?? "parentbased_always_on";
  const ratio = Number(process.env.OTEL_TRACES_SAMPLER_ARG ?? "1");
  const root = name.endsWith("traceidratio")
    ? new tracing.TraceIdRatioBasedSampler(
        Number.isFinite(ratio) && ratio >= 0 && ratio <= 1 ? ratio : 1,
      )
    : name.endsWith("always_off")
      ? new tracing.AlwaysOffSampler()
      : new tracing.AlwaysOnSampler();
  const configured = ["always_on", "always_off", "traceidratio"].includes(name)
    ? root
    : new tracing.ParentBasedSampler({ root });
  const usage = new tracing.AlwaysOnSampler();
  return {
    shouldSample: (...args: Parameters<tracing.Sampler["shouldSample"]>) =>
      args[4]["orvo.scout.purpose"]
        ? usage.shouldSample()
        : configured.shouldSample(...args),
    toString: () => `ScoutUsageAlwaysOn(${configured.toString()})`,
  };
};
export { createSelfTelemetrySampler };
