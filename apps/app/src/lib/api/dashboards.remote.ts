import { command, getRequestEvent, query } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import {
  createDashboardInputSchema,
  updateDashboardInputSchema,
  dashboardIdInputSchema,
  pinDashboardInputSchema,
  dashboardPanelDataInputSchema,
} from "$lib/server/services/dashboard";
import { err } from "@repo/utils";

export const createDashboardCommand = command(
  createDashboardInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const context = await resolveRequestAppContext(event);
    if (!context.success) return err(context.error);
    return event.locals.container.dashboardService.createDashboard(input, {
      appId: context.data.appId,
      userId: event.locals.auth!.user.id,
    });
  },
);
export const updateDashboardCommand = command(
  updateDashboardInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const context = await resolveRequestAppContext(event);
    if (!context.success) return err(context.error);
    return event.locals.container.dashboardService.updateDashboard(input, {
      appId: context.data.appId,
    });
  },
);
export const deleteDashboardCommand = command(
  dashboardIdInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const context = await resolveRequestAppContext(event);
    if (!context.success) return err(context.error);
    return event.locals.container.dashboardService.deleteDashboard(input, {
      appId: context.data.appId,
    });
  },
);
export const pinDashboardCommand = command(
  pinDashboardInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const context = await resolveRequestAppContext(event);
    if (!context.success) return err(context.error);
    return event.locals.container.dashboardService.pinDashboard(input, {
      appId: context.data.appId,
      userId: event.locals.auth!.user.id,
    });
  },
);
export const getDashboardPanelDataQuery = query(
  dashboardPanelDataInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const context = await resolveRequestAppContext(event);
    if (!context.success) return err(context.error);
    return event.locals.container.dashboardService.getPanelData(input, {
      appId: context.data.appId,
    });
  },
);
