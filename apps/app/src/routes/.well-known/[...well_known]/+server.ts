import { env } from "$env/dynamic/private";
import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import { error, type RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async (event) => {
  if (
    event.params.well_known === "oauth-authorization-server" ||
    event.params.well_known === "oauth-authorization-server/api/auth"
  ) {
    return oauthProviderAuthServerMetadata(event.locals.container.authService)(
      event.request,
    );
  }

  if (
    event.params.well_known === "openid-configuration" ||
    event.params.well_known === "openid-configuration/api/auth"
  ) {
    return oauthProviderOpenIdConfigMetadata(
      event.locals.container.authService,
    )(event.request);
  }

  if (event.params.well_known === "oauth-protected-resource/api/mcp") {
    const metadata = await oauthProviderResourceClient(
      event.locals.container.authService,
    )
      .getActions()
      .getProtectedResourceMetadata({
        resource: `${new URL(env.ORIGIN).origin}/api/mcp`,
        scopes_supported: ["mcp:read"],
      });
    return Response.json(metadata, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }

  throw error(404, "Not found");
};
