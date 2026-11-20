import { z } from "zod";
import { dashboardDefinitionSchema, dashboardPanelSchema } from "./schema";

const dashboardEditorDescriptorSchema = z.object({
  editorId: z.string().min(1).max(100),
  dashboardId: z.string().min(1).max(255),
});
const target = dashboardEditorDescriptorSchema.extend({
  revision: z.number().int().nonnegative(),
});
const dashboardEditorToolSchemas = {
  get_dashboard_editor: dashboardEditorDescriptorSchema,
  edit_dashboard: target.extend({
    settings: dashboardDefinitionSchema
      .pick({ name: true, description: true, timeRange: true })
      .partial(),
  }),
  upsert_dashboard_panel: target.extend({
    panel: z
      .object(dashboardPanelSchema.shape)
      .partial()
      .describe(
        "An existing id patches that panel; a new id creates a panel with that id. Omit id to generate one for a new panel. Reuse the returned id for subsequent edits. Omitted fields are preserved. Positions and sizes use integer grid units in 24 columns. Token measures input_tokens/output_tokens/total_tokens sum per-call GenAI span usage; source must be traces. Model and provider are optional filters. Group by model or provider for a breakdown.",
      ),
  }),
  layout_dashboard: target.extend({
    placements: z
      .array(
        z.object(dashboardPanelSchema.shape).pick({
          id: true,
          x: true,
          y: true,
          w: true,
          h: true,
        }),
      )
      .min(1)
      .max(100)
      .describe(
        "Apply all affected panel positions together. Include every panel that must move, including panels swapping places. Unspecified panels stay put; overlaps or out-of-bounds placements are rejected, never silently pushed.",
      ),
  }),
  review_dashboard_layout: target,
  remove_dashboard_panel: target.extend({
    panelId: z.string().min(1).max(100),
  }),
  preview_dashboard_panel: target.extend({
    panelId: z.string().min(1).max(100),
  }),
  save_dashboard: target,
};
const isDashboardEditorTool = (
  name: string,
): name is keyof typeof dashboardEditorToolSchemas =>
  Object.hasOwn(dashboardEditorToolSchemas, name);
export {
  dashboardEditorDescriptorSchema,
  dashboardEditorToolSchemas,
  isDashboardEditorTool,
};
