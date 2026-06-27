import { command, getRequestEvent, query } from "$app/server";
import {
  createAlertRuleInputSchema,
  deleteAlertRuleInputSchema,
  getAlertRuleInputSchema,
  setAlertRuleEnabledInputSchema,
  updateAlertRuleInputSchema,
} from "$lib/server/services/alert-rule";
import { resolveRequestAppContext } from "$lib/server/request-context";
import { err } from "@repo/utils";
import { z } from "zod";
import { getActiveOrganizationId } from "$lib/server/request-context";

export const getAlertRulesQuery = query(z.object({}), async () => {
  const event = getRequestEvent();
  const appContext = await resolveRequestAppContext(event);

  if (!appContext.success) {
    return err(appContext.error);
  }

  return event.locals.container.alertRuleService.getAlertRules({
    appId: appContext.data.appId,
  });
});

export const getAlertRuleQuery = query(
  getAlertRuleInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.alertRuleService.getAlertRule(input, {
      appId: appContext.data.appId,
    });
  },
);

export const createAlertRuleCommand = command(
  createAlertRuleInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);
    const organizationId = getActiveOrganizationId(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    if (!organizationId) {
      return err("No active organization selected.");
    }

    const result =
      await event.locals.container.alertRuleService.createAlertRule(input, {
        appId: appContext.data.appId,
        userId: event.locals.auth!.user.id,
      });

    if (result.success) {
      await event.locals.container.organizationActivationService.markFirstAlertCreated(
        {
          organizationId,
        },
      );
    }

    return result;
  },
);

export const updateAlertRuleCommand = command(
  updateAlertRuleInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.alertRuleService.updateAlertRule(input, {
      appId: appContext.data.appId,
      userId: event.locals.auth!.user.id,
    });
  },
);

export const setAlertRuleEnabledCommand = command(
  setAlertRuleEnabledInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.alertRuleService.setAlertRuleEnabled(input, {
      appId: appContext.data.appId,
      userId: event.locals.auth!.user.id,
    });
  },
);

export const deleteAlertRuleCommand = command(
  deleteAlertRuleInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.alertRuleService.deleteAlertRule(input, {
      appId: appContext.data.appId,
    });
  },
);
