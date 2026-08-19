import { env } from "$env/dynamic/private";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import {
  createMcpHandler,
  hostHeaderValidationResponse,
  type AuthInfo,
  type McpServer,
} from "@modelcontextprotocol/server";
import type { RequestHandler } from "./$types";

const handler = createMcpHandler(
  ({ authInfo }) => {
    const server = authInfo?.extra?.server;
    if (!server) throw new Error("Missing authenticated MCP server context.");
    return server as McpServer;
  },
  {
    legacy: "stateless",
    responseMode: "auto",
  },
);

const unauthorized = (origin: string) =>
  Response.json(
    {
      error: "invalid_token",
      error_description: "A valid MCP access token is required.",
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${origin}/api/mcp/.well-known/oauth-protected-resource"`,
        "Access-Control-Expose-Headers":
          "WWW-Authenticate, MCP-Protocol-Version",
      },
    },
  );

export const POST: RequestHandler = async (event) => {
  const mcpOrigin = new URL(env.ORIGIN).origin;
  const hostError = hostHeaderValidationResponse(event.request, [
    new URL(mcpOrigin).hostname,
  ]);
  if (hostError) return hostError;

  const requestOrigin = event.request.headers.get("origin");
  if (requestOrigin && requestOrigin !== mcpOrigin) {
    return new Response("Forbidden", { status: 403 });
  }

  let payload: {
    azp?: unknown;
    exp?: unknown;
    organization_id?: unknown;
    scope?: unknown;
    sub?: unknown;
  };

  try {
    payload = await oauthProviderResourceClient(
      event.locals.container.authService,
    )
      .getActions()
      .verifyAccessTokenRequest(event.request, {
        jwksUrl: `${mcpOrigin}/api/auth/jwks`,
        verifyOptions: {
          audience: `${mcpOrigin}/api/mcp`,
          issuer: `${mcpOrigin}/api/auth`,
        },
        scopes: ["mcp:read"],
      });
  } catch {
    return unauthorized(mcpOrigin);
  }

  const clientId = typeof payload.azp === "string" ? payload.azp : null;
  const userId = typeof payload.sub === "string" ? payload.sub : null;
  const organizationId =
    typeof payload.organization_id === "string"
      ? payload.organization_id
      : null;
  const expiresAt = typeof payload.exp === "number" ? payload.exp : null;
  if (!clientId || !userId || !organizationId || !expiresAt) {
    return unauthorized(mcpOrigin);
  }

  const grant = await event.locals.container.mcpOauthGrantService.resolveGrant(
    { clientId },
    { userId },
  );
  if (!grant.success || grant.data.organizationId !== organizationId) {
    return unauthorized(mcpOrigin);
  }

  const authorization = event.request.headers.get("authorization") ?? "";
  const authInfo: AuthInfo = {
    token: authorization.replace(/^Bearer\s+/i, ""),
    clientId,
    scopes: String(payload.scope ?? "")
      .split(/\s+/)
      .filter(Boolean),
    expiresAt,
    resource: new URL(`${mcpOrigin}/api/mcp`),
    extra: {
      organizationId,
      server: event.locals.container.mcpService.createServer({
        organizationId,
      }),
    },
  };

  const response = await handler.fetch(event.request, { authInfo });
  const headers = new Headers(response.headers);
  headers.set(
    "Access-Control-Expose-Headers",
    "WWW-Authenticate, MCP-Protocol-Version",
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
