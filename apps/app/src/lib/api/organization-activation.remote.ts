import { command, getRequestEvent } from "$app/server";
import { getActiveOrganizationId } from "$lib/server/request-context";
import { err } from "@repo/utils";
import { z } from "zod";

export const markOrganizationActivationTelemetryViewedCommand = command(
  z.object({}),
  () => {
    const event = getRequestEvent();
    const organizationId = getActiveOrganizationId(event);

    if (!organizationId) {
      return err("No active organization selected.");
    }

    return event.locals.container.organizationActivationService.markTelemetryViewed(
      {
        organizationId,
      },
    );
  },
);
