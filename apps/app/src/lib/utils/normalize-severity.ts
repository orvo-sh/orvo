const normalizeSeverity = (
  severity: number,
  severityText?: string,
): "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "unknown" => {
  if (severity >= 21) return "fatal";
  if (severity >= 17) return "error";
  if (severity >= 13) return "warn";
  if (severity >= 9) return "info";
  if (severity >= 5) return "debug";
  if (severity >= 1) return "trace";

  const normalizedText = severityText?.trim().toLowerCase() ?? "";
  if (normalizedText === "fatal") return "fatal";
  if (normalizedText.includes("err")) return "error";
  if (normalizedText.includes("warn")) return "warn";
  if (normalizedText.includes("debug")) return "debug";
  if (normalizedText === "trace") return "trace";
  if (normalizedText.includes("info")) return "info";

  return "unknown";
};

export { normalizeSeverity };
