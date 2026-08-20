import { env } from "$env/dynamic/private";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import { error, type RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async (event) => {
  if (event.params.well_known !== "oauth-protected-resource") {
    throw error(404, "Not found");
  }

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
};
