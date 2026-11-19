import { z } from "zod";

const dashboardTimeRanges = [
  "last_30_minutes",
  "last_hour",
  "last_4_hours",
  "last_24_hours",
  "last_7_days",
] as const;
const dashboardPanelSchema = z
  .object({
    id: z.string().min(1).max(100),
    title: z.string().trim().min(1).max(120),
    visualization: z.enum([
      "time_series",
      "stat",
      "table",
      "bar",
      "logs",
      "text",
    ]),
    x: z.number().int().min(0).max(23),
    y: z.number().int().min(0).max(10000),
    w: z.number().int().min(4).max(24),
    h: z.number().int().min(3).max(30),
    source: z.enum(["traces", "logs", "metrics"]),
    measure: z.enum([
      "count",
      "error_rate",
      "duration",
      "value",
      "input_tokens",
      "output_tokens",
      "total_tokens",
    ]),
    aggregation: z.enum(["avg", "min", "max", "p50", "p95", "p99", "sum"]),
    metricName: z.string().trim().max(255),
    service: z.string().trim().max(255),
    environment: z.string().trim().max(255),
    groupBy: z.enum(["none", "service", "host", "model", "provider"]),
    model: z.string().trim().max(255).optional(),
    provider: z.string().trim().max(255).optional(),
    unit: z.enum(["auto", "ms", "%", "bytes", "s", "tokens"]),
    text: z.string().max(10000),
  })
  .refine((panel) => panel.x + panel.w <= 24, {
    message: "Panel extends outside the grid.",
    path: ["w"],
  })
  .refine(
    (panel) =>
      panel.visualization === "text" ||
      (panel.visualization === "logs"
        ? panel.source === "logs"
        : panel.source === "traces"
          ? [
              "count",
              "error_rate",
              "duration",
              "input_tokens",
              "output_tokens",
              "total_tokens",
            ].includes(panel.measure)
          : panel.source === "logs"
            ? ["count", "error_rate"].includes(panel.measure)
            : panel.measure === "value" && panel.metricName.length > 0),
    {
      message: "Choose a valid signal for this visualization.",
      path: ["measure"],
    },
  );

const dashboardDefinitionSchema = z.object({
  name: z.string().trim().min(1, "Enter a dashboard name.").max(120),
  description: z.string().trim().max(500).default(""),
  timeRange: z.enum(dashboardTimeRanges).default("last_hour"),
  panels: z
    .array(dashboardPanelSchema)
    .max(100)
    .superRefine((panels, ctx) => {
      if (new Set(panels.map((p) => p.id)).size !== panels.length)
        ctx.addIssue({ code: "custom", message: "Panel IDs must be unique." });
      for (let i = 0; i < panels.length; i++)
        for (let j = i + 1; j < panels.length; j++) {
          const a = panels[i],
            b = panels[j];
          if (
            a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y
          ) {
            ctx.addIssue({ code: "custom", message: "Panels cannot overlap." });
            return;
          }
        }
    }),
});

type DashboardPanel = z.infer<typeof dashboardPanelSchema>;
export {
  dashboardTimeRanges,
  dashboardPanelSchema,
  dashboardDefinitionSchema,
  type DashboardPanel,
};
