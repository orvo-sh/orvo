import { z } from "zod";
import { dashboardDefinitionSchema, type DashboardPanel } from "./schema";
import {
  dashboardEditorToolSchemas,
  isDashboardEditorTool,
} from "./editor-schema";
import { createDashboardPanel } from "./panels";
import {
  GRID_COLUMNS,
  GRID_ROW_HEIGHT,
  GRID_GAP,
  placePanel,
  nextPosition,
} from "./grid";
import { reviewDashboardLayout } from "./layout-review";

const createDashboardEditorController = (options: {
  editorId: string;
  dashboardId: string;
  isActive: () => boolean;
  getGridWidth?: () => number;
  getForm: () => z.infer<typeof dashboardDefinitionSchema>;
  setForm: (form: z.infer<typeof dashboardDefinitionSchema>) => void;
  reveal: (panelId?: string) => Promise<void>;
  preview: (
    panel: DashboardPanel,
    timeRange: z.infer<typeof dashboardDefinitionSchema>["timeRange"],
  ) => Promise<{
    success: boolean;
    data?: {
      series: { name: string; value: number | null }[];
      logs: unknown[];
      unit: string;
    };
    error?: string;
  }>;
  save: (
    form: z.infer<typeof dashboardDefinitionSchema>,
  ) => Promise<{ success: boolean; error?: string }>;
}) => {
  let revision = 0;
  let fingerprint = JSON.stringify(options.getForm());
  let busy = false;
  const layoutFingerprint = (panels: DashboardPanel[]) =>
    JSON.stringify({
      width: options.getGridWidth?.() ?? null,
      panels: panels
        .map(({ id, visualization, x, y, w, h }) => ({
          id,
          visualization,
          x,
          y,
          w,
          h,
        }))
        .toSorted((a, b) => a.id.localeCompare(b.id)),
    });
  let reviewedLayout: string | null = layoutFingerprint(
    options.getForm().panels,
  );
  const snapshot = () => {
    const form = structuredClone(options.getForm());
    const current = JSON.stringify(form);
    if (current !== fingerprint) {
      fingerprint = current;
      revision++;
    }
    return {
      editorId: options.editorId,
      dashboardId: options.dashboardId,
      revision,
      form,
      grid: {
        columns: GRID_COLUMNS,
        rowHeightPx: GRID_ROW_HEIGHT,
        gapPx: GRID_GAP,
        minimumWidth: 4,
        minimumHeight: 3,
        canvasWidth: options.getGridWidth?.() || null,
        coordinates:
          "Zero-based grid cells, not pixels. A panel spans [x, x+w) and [y, y+h); x+w must be <=24. Adjacent panels touch in grid coordinates; CSS adds the 12px gap automatically. Height in pixels = h*32+(h-1)*12.",
        recommendedSizes: {
          stat: { w: 6, h: 3 },
          time_series: { w: 12, h: 7 },
          bar: { w: 12, h: 7 },
          table: { w: 12, h: 8 },
          logs: { w: 24, h: 9 },
          text: { w: 24, h: 3 },
        },
        layoutNeedsReview: reviewedLayout !== layoutFingerprint(form.panels),
      },
      tokenUsage: {
        source: "traces",
        measures: ["input_tokens", "output_tokens", "total_tokens"],
        service: "orvo-app-server",
        groupBy: ["model", "provider"],
        note: "Each token measure sums reported usage per model call. Do not add total tokens to input or output tokens. Missing usage is not reported as zero.",
      },
    };
  };
  const execute = async (name: string, input: unknown) => {
    if (!isDashboardEditorTool(name))
      return { error: "Unknown dashboard editor action." };
    const parsed = dashboardEditorToolSchemas[name].safeParse(input);
    if (!parsed.success) return { error: parsed.error.message };
    const target = parsed.data;
    if (
      !options.isActive() ||
      target.editorId !== options.editorId ||
      target.dashboardId !== options.dashboardId
    )
      return {
        error:
          "The target dashboard editor is no longer open. Stop editing this page.",
      };
    if (busy)
      return {
        error: "Another editor action is running. Run actions sequentially.",
      };
    if (name === "get_dashboard_editor") return { data: snapshot() };
    const expected = "revision" in target ? target.revision : -1;
    const assertCurrent = () => {
      if (!options.isActive())
        throw new Error(
          "The dashboard editor was closed. Stop editing this page.",
        );
      if (snapshot().revision !== expected)
        throw new Error(
          "The dashboard changed. Read get_dashboard_editor again and preserve the user's changes.",
        );
    };
    busy = true;
    try {
      assertCurrent();
      const next = structuredClone(options.getForm());
      let panelId: string | undefined;
      if (name === "edit_dashboard")
        Object.assign(
          next,
          dashboardEditorToolSchemas.edit_dashboard.parse(input).settings,
        );
      else if (name === "upsert_dashboard_panel") {
        const { panel: patch } =
          dashboardEditorToolSchemas.upsert_dashboard_panel.parse(input);
        const previous = patch.id
          ? next.panels.find((p) => p.id === patch.id)
          : undefined;
        const panel = {
          ...(previous ??
            createDashboardPanel(
              next.panels,
              patch.visualization ?? "time_series",
            )),
          ...patch,
        };
        if (
          !previous &&
          patch.source === "metrics" &&
          patch.measure === undefined
        )
          panel.measure = "value";
        if (panel.visualization === "logs") {
          panel.source = "logs";
          panel.measure = "count";
        }
        if (!previous && patch.x === undefined && patch.y === undefined)
          Object.assign(panel, nextPosition(next.panels, panel.w, panel.h));
        panelId = panel.id;
        next.panels = previous
          ? next.panels.map((p) => (p.id === panelId ? panel : p))
          : [...next.panels, panel];
        next.panels = placePanel(next.panels, panel.id, panel);
      } else if (name === "layout_dashboard") {
        const { placements } =
          dashboardEditorToolSchemas.layout_dashboard.parse(input);
        if (
          new Set(placements.map((panel) => panel.id)).size !==
          placements.length
        )
          throw new Error("Each panel may appear only once in the layout.");
        for (const placement of placements)
          if (!next.panels.some((panel) => panel.id === placement.id))
            throw new Error(
              `Unknown panel ${placement.id}. Read the editor and use its existing IDs.`,
            );
        next.panels = next.panels.map((panel) => ({
          ...panel,
          ...placements.find((placement) => placement.id === panel.id),
        }));
      } else if (name === "review_dashboard_layout") {
        const report = reviewDashboardLayout(
          next.panels,
          options.getGridWidth?.(),
        );
        reviewedLayout = layoutFingerprint(next.panels);
        return { data: { ...snapshot(), layoutReview: report } };
      } else if (name === "remove_dashboard_panel") {
        const { panelId: id } =
          dashboardEditorToolSchemas.remove_dashboard_panel.parse(input);
        if (!next.panels.some((p) => p.id === id))
          throw new Error("Panel not found.");
        next.panels = next.panels.filter((p) => p.id !== id);
      } else if (name === "preview_dashboard_panel") {
        const { panelId: id } =
          dashboardEditorToolSchemas.preview_dashboard_panel.parse(input);
        const panel = next.panels.find((p) => p.id === id);
        if (!panel) throw new Error("Panel not found.");
        const result = await options.preview(panel, next.timeRange);
        assertCurrent();
        if (!result.success || !result.data)
          throw new Error(result.error ?? "Failed to preview panel.");
        return {
          data: {
            ...snapshot(),
            preview: {
              panelId: id,
              unit: result.data.unit,
              series: result.data.series.map(({ name, value }) => ({
                name,
                value,
              })),
              logCount: result.data.logs.length,
            },
          },
        };
      } else if (name === "save_dashboard") {
        if (reviewedLayout !== layoutFingerprint(next.panels))
          throw new Error(
            "The layout changed. Call review_dashboard_layout, assess its warnings, correct unintended issues with layout_dashboard, and review again before saving.",
          );
        const validated = dashboardDefinitionSchema.parse(next);
        const result = await options.save(validated);
        if (!result.success)
          throw new Error(result.error ?? "Could not save dashboard.");
        return {
          data: { ...snapshot(), saved: true, savedRevision: expected },
        };
      }
      const validated = dashboardDefinitionSchema.parse(next);
      options.setForm(validated);
      if (name === "layout_dashboard") reviewedLayout = null;
      await options.reveal(panelId);
      return { data: snapshot() };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Dashboard editor action failed.",
        data: snapshot(),
      };
    } finally {
      busy = false;
    }
  };
  return {
    editorId: options.editorId,
    dashboardId: options.dashboardId,
    execute,
  };
};
export { createDashboardEditorController };
