import { command, getRequestEvent, query } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import {
  listMcpConnectionsInputSchema,
  revokeMcpConnectionInputSchema,
} from "$lib/server/services/mcp-oauth-grant";
import { err } from "@repo/utils";

const getContext = async () => {
  const event = getRequestEvent();
  const appContext = await resolveRequestAppContext(event);
  if (!appContext.success || !event.locals.auth) return null;

  return {
    event,
    context: {
      organizationId: appContext.data.organizationId,
      userId: event.locals.auth.user.id,
    },
  };
};

const listMcpConnectionsQuery = query(
  listMcpConnectionsInputSchema,
  async (input) => {
    const request = await getContext();
    if (!request) return err("App context is missing.");

    return request.event.locals.container.mcpOauthGrantService.listConnections(
      input,
      request.context,
    );
  },
);

const revokeMcpConnectionCommand = command(
  revokeMcpConnectionInputSchema,
  async (input) => {
    const request = await getContext();
    if (!request) return err("App context is missing.");

    return request.event.locals.container.mcpOauthGrantService.revokeConnection(
      input,
      request.context,
    );
  },
);

export { listMcpConnectionsQuery, revokeMcpConnectionCommand };
