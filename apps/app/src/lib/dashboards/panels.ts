import { genId } from "@repo/utils";
import { nextPosition } from "./grid";
import type { DashboardPanel } from "./schema";

const createDashboardPanel = (
  panels: DashboardPanel[],
  visualization: DashboardPanel["visualization"],
): DashboardPanel => ({
  id: genId("panel"),
  title: {
    time_series: "Time series",
    stat: "Stat",
    table: "Table",
    bar: "Bar chart",
    logs: "Logs",
    text: "Text",
  }[visualization],
  visualization,
  ...nextPosition(
    panels,
    visualization === "stat" ? 6 : 12,
    visualization === "stat" ? 3 : 6,
  ),
  source: visualization === "logs" ? "logs" : "traces",
  measure: "count",
  aggregation: "avg",
  metricName: "",
  service: "",
  environment: "",
  groupBy: "none",
  unit: "auto",
  text: "",
});
export { createDashboardPanel };
