import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
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
    return oauthProviderOpenIdConfigMetadata(event.locals.container.authService)(
      event.request,
    );
  }

  throw error(404, "Not found");
};
