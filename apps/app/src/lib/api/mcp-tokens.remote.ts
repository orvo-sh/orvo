import { command, getRequestEvent, query } from "$app/server";
import { getActiveOrganizationId } from "$lib/server/request-context";
import {
  createMcpTokenInputSchema,
  listMcpTokensInputSchema,
  revokeMcpTokenInputSchema,
} from "$lib/server/services/mcp-token";
import { err } from "@repo/utils";

export const listMcpTokensQuery = query(
  listMcpTokensInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const organizationId = getActiveOrganizationId(event);

    if (!organizationId) {
      return err("No active organization selected.");
    }

    return event.locals.container.mcpTokenService.listMcpTokens(input, {
      organizationId,
    });
  },
);

export const createMcpTokenCommand = command(
  createMcpTokenInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const organizationId = getActiveOrganizationId(event);

    if (!organizationId) {
      return err("No active organization selected.");
    }

    return event.locals.container.mcpTokenService.createMcpToken(input, {
      organizationId,
      userId: event.locals.auth!.user.id,
    });
  },
);

export const revokeMcpTokenCommand = command(
  revokeMcpTokenInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const organizationId = getActiveOrganizationId(event);

    if (!organizationId) {
      return err("No active organization selected.");
    }

    return event.locals.container.mcpTokenService.revokeMcpToken(input, {
      organizationId,
    });
  },
);
