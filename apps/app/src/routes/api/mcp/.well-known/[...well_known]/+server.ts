import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import { error, type RequestHandler } from "@sveltejs/kit";

import { mcpTokenScopeValues } from "$lib/server/services/mcp-token/schema";

export const GET: RequestHandler = async (event) => {
  if (event.params.well_known === "oauth-protected-resource") {
    const metadata = await oauthProviderResourceClient(
      event.locals.container.authService,
    )
      .getActions()
      .getProtectedResourceMetadata({
        resource: `${event.url.origin}/api/mcp`,
        scopes_supported: [...mcpTokenScopeValues],
      });

    return new Response(JSON.stringify(metadata), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }

  throw error(404, "Not found");
};
