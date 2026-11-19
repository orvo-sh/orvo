import { z } from "zod";
import {
  dashboardDefinitionSchema,
  dashboardPanelSchema,
  dashboardTimeRanges,
} from "$lib/dashboards/schema";

const dashboardIdInputSchema = z.object({ id: z.string().min(1).max(100) });
const createDashboardInputSchema = dashboardDefinitionSchema;
const updateDashboardInputSchema = dashboardDefinitionSchema.extend({
  id: z.string().min(1).max(100),
  revision: z.number().int().positive(),
});
const pinDashboardInputSchema = dashboardIdInputSchema.extend({
  pinned: z.boolean(),
});
const dashboardPanelDataInputSchema = z.object({
  panel: dashboardPanelSchema,
  timeRange: z.enum(dashboardTimeRanges),
});
export {
  dashboardIdInputSchema,
  createDashboardInputSchema,
  updateDashboardInputSchema,
  pinDashboardInputSchema,
  dashboardPanelDataInputSchema,
};
