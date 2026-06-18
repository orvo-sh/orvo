import { command, getRequestEvent, query } from "$app/server";
import { z } from "zod";

import {
  createDashboardLogViewInputSchema,
  deleteDashboardLogViewInputSchema,
  updateDashboardLogViewInputSchema,
} from "$lib/server/services/dashboard-log-view.service";
import { resolveRequestAppContext } from "$lib/server/request-context";
import { err } from "@repo/utils";

export const getDashboardLogViewsQuery = query(z.object({}), async () => {
  const event = getRequestEvent();
  const appContext = await resolveRequestAppContext(event);

  if (!appContext.success) {
    return err(appContext.error);
  }

  return event.locals.container.dashboardLogViewService.getDashboardLogViews({
    appId: appContext.data.appId,
  });
});

export const createDashboardLogViewCommand = command(
  createDashboardLogViewInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.dashboardLogViewService.createDashboardLogView(
      input,
      {
        appId: appContext.data.appId,
        userId: event.locals.auth!.user.id,
      },
    );
  },
);

export const updateDashboardLogViewCommand = command(
  updateDashboardLogViewInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.dashboardLogViewService.updateDashboardLogView(
      input,
      {
        appId: appContext.data.appId,
        userId: event.locals.auth!.user.id,
      },
    );
  },
);

export const deleteDashboardLogViewCommand = command(
  deleteDashboardLogViewInputSchema,
  async (id) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.dashboardLogViewService.deleteDashboardLogView(
      id,
      {
        appId: appContext.data.appId,
      },
    );
  },
);
