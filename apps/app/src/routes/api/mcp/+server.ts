import type { RequestHandler } from "@sveltejs/kit";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import { mcpTokenScopeValues } from "$lib/server/services/mcp-token/schema";
import { genId } from "@repo/utils";

const protocolVersion = "2025-11-25";
const sessionHeaderName = "MCP-Session-Id";
const sessionTtlMs = 12 * 60 * 60 * 1000;
const keepaliveIntervalMs = 15_000;
const readOnlyChallengeScopes = [
  "app:read",
  "logs:read",
  "traces:read",
  "metrics:read",
  "incidents:read",
  "heartbeats:read",
  "alerts:read",
].join(" ");

type AuthContext = {
  tokenId: string;
  organizationId: string;
  scopes: string[];
  allowedAppIds: string[];
  subjectType: "mcp_token" | "oauth_access_token";
  tokenPrefix: string;
  tokenName: string;
};

type SessionRecord = {
  id: string;
  tokenId: string;
  organizationId: string;
  scopes: string[];
  createdAt: number;
  lastSeenAt: number;
};

declare global {
  var __orvoMcpSessions: Map<string, SessionRecord> | undefined;
}

const mcpSessions = (globalThis.__orvoMcpSessions ??= new Map<
  string,
  SessionRecord
>());
const encoder = new TextEncoder();

const validateOrigin = (request: Request, currentOrigin: string) => {
  const origin = request.headers.get("origin");

  return !origin || origin === currentOrigin;
};

const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization");

  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
};

const wantsSseResponse = (request: Request) =>
  (request.headers.get("accept") ?? "")
    .toLowerCase()
    .includes("text/event-stream");

const createJsonResponse = (
  payload: Record<string, unknown>,
  status = 200,
  headers?: HeadersInit,
) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "MCP-Protocol-Version": protocolVersion,
      ...headers,
    },
  });

const createJsonRpcErrorPayload = (
  id: string | number | null,
  code: number,
  message: string,
) => ({
  jsonrpc: "2.0",
  id,
  error: {
    code,
    message,
  },
});

const createJsonRpcError = (
  id: string | number | null,
  code: number,
  message: string,
  status = 200,
  headers?: HeadersInit,
) =>
  createJsonResponse(
    createJsonRpcErrorPayload(id, code, message),
    status,
    headers,
  );

const createUnauthorizedResponse = (origin: string) =>
  createJsonResponse(
    {
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Unauthorized",
      },
    },
    401,
    {
      "WWW-Authenticate": `Bearer realm="Orvo MCP", scope="${readOnlyChallengeScopes}", resource_metadata="${origin}/api/mcp/.well-known/oauth-protected-resource"`,
      "Access-Control-Expose-Headers": "WWW-Authenticate",
    },
  );

const pruneExpiredSessions = () => {
  const now = Date.now();

  for (const [sessionId, session] of mcpSessions.entries()) {
    if (now - session.lastSeenAt > sessionTtlMs) {
      mcpSessions.delete(sessionId);
    }
  }
};

const createSession = (authContext: AuthContext) => {
  pruneExpiredSessions();

  const id = genId("mcps");
  const now = Date.now();

  mcpSessions.set(id, {
    id,
    tokenId: authContext.tokenId,
    organizationId: authContext.organizationId,
    scopes: authContext.scopes,
    createdAt: now,
    lastSeenAt: now,
  });

  return id;
};

const getSession = (sessionId: string | null) => {
  if (!sessionId) {
    return null;
  }

  pruneExpiredSessions();

  const session = mcpSessions.get(sessionId);

  if (!session) {
    return null;
  }

  if (Date.now() - session.lastSeenAt > sessionTtlMs) {
    mcpSessions.delete(sessionId);
    return null;
  }

  return session;
};

const touchSession = (sessionId: string) => {
  const existing = mcpSessions.get(sessionId);

  if (!existing) {
    return;
  }

  existing.lastSeenAt = Date.now();
  mcpSessions.set(sessionId, existing);
};

const serializeSseEvent = (payload: {
  event?: string;
  id?: string;
  data?: string;
}) => {
  const lines: string[] = [];

  if (payload.id) {
    lines.push(`id: ${payload.id}`);
  }

  if (payload.event) {
    lines.push(`event: ${payload.event}`);
  }

  if (payload.data !== undefined) {
    const parts = payload.data.split("\n");

    if (parts.length === 0) {
      lines.push("data:");
    } else {
      for (const part of parts) {
        lines.push(`data: ${part}`);
      }
    }
  }

  return `${lines.join("\n")}\n\n`;
};

const createSseResponse = (
  stream: ReadableStream<Uint8Array>,
  headers?: HeadersInit,
) =>
  new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "MCP-Protocol-Version": protocolVersion,
      "X-Accel-Buffering": "no",
      ...headers,
    },
  });

const createSingleEventSseResponse = (
  payload: Record<string, unknown>,
  headers?: HeadersInit,
) =>
  createSseResponse(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            serializeSseEvent({
              id: genId("mcpe"),
              data: "",
            }),
          ),
        );
        controller.enqueue(
          encoder.encode(
            serializeSseEvent({
              id: genId("mcpe"),
              data: JSON.stringify(payload),
            }),
          ),
        );
        controller.close();
      },
    }),
    headers,
  );

const resolveAuthContext = async (
  request: Request,
  locals: App.Locals,
  getClientAddress: () => string,
) => {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  if (token.startsWith("orvo_mcp_")) {
    return locals.container.mcpTokenService.validateMcpToken({
      token,
      ipAddress: getClientAddress(),
      userAgent: request.headers.get("user-agent"),
    });
  }

  let oauthPayload: {
    azp?: unknown;
    jti?: unknown;
    scope?: unknown;
    sub?: unknown;
  } | null = null;

  try {
    oauthPayload = await oauthProviderResourceClient(
      locals.container.authService,
    )
      .getActions()
      .verifyBearerToken(token, {
        verifyOptions: {
          audience: `${new URL(request.url).origin}/api/mcp`,
        },
      });
  } catch {
    return null;
  }

  const clientId =
    typeof oauthPayload?.azp === "string" ? oauthPayload.azp : null;
  const userId =
    typeof oauthPayload?.sub === "string" ? oauthPayload.sub : null;

  if (!clientId || !userId) {
    return null;
  }

  const grant = await locals.container.mcpOauthGrantService.resolveGrant(
    {
      clientId,
    },
    {
      userId,
    },
  );

  if (!grant.success) {
    return null;
  }

  return {
    tokenId:
      (typeof oauthPayload.jti === "string" && oauthPayload.jti) ||
      `${clientId}:${userId}`,
    organizationId: grant.data.organizationId,
    scopes: String(oauthPayload.scope ?? "")
      .split(/\s+/)
      .map((value) => value.trim())
      .filter((value) =>
        mcpTokenScopeValues.includes(
          value as (typeof mcpTokenScopeValues)[number],
        ),
      ),
    allowedAppIds: grant.data.allowedAppIds,
    subjectType: "oauth_access_token" as const,
    tokenPrefix: clientId,
    tokenName: "OAuth access token",
  };
};

const validateSession = (request: Request, authContext: AuthContext) => {
  const sessionId = request.headers.get(sessionHeaderName);
  const session = getSession(sessionId);

  if (!sessionId) {
    return {
      ok: false as const,
      response: createJsonRpcError(
        null,
        -32002,
        `Missing ${sessionHeaderName}.`,
        400,
      ),
    };
  }

  if (!session) {
    return {
      ok: false as const,
      response: createJsonRpcError(
        null,
        -32003,
        `Unknown ${sessionHeaderName}.`,
        404,
      ),
    };
  }

  if (
    session.tokenId !== authContext.tokenId ||
    session.organizationId !== authContext.organizationId
  ) {
    return {
      ok: false as const,
      response: createUnauthorizedResponse(new URL(request.url).origin),
    };
  }

  touchSession(session.id);

  return {
    ok: true as const,
    session,
  };
};

const executeRequest = async (
  requestPayload: {
    id: string | number | null;
    method: string;
    params?: Record<string, unknown>;
  },
  authContext: AuthContext,
  locals: App.Locals,
) => {
  if (requestPayload.method === "initialize") {
    const sessionId = createSession(authContext);

    return {
      headers: {
        [sessionHeaderName]: sessionId,
      },
      payload: {
        jsonrpc: "2.0",
        id: requestPayload.id,
        result: {
          protocolVersion,
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: {
            name: "orvo",
            version: "0.0.1",
          },
          instructions:
            "Orvo exposes organization-scoped observability tools. MCP tokens can be limited to selected apps within the organization.",
        },
      },
    };
  }

  if (requestPayload.method === "ping") {
    return {
      payload: {
        jsonrpc: "2.0",
        id: requestPayload.id,
        result: {},
      },
    };
  }

  if (requestPayload.method === "tools/list") {
    const result = await locals.container.mcpService.listTools({
      organizationId: authContext.organizationId,
      allowedAppIds: authContext.allowedAppIds,
      scopes: authContext.scopes,
    });

    return {
      payload: {
        jsonrpc: "2.0",
        id: requestPayload.id,
        result,
      },
    };
  }

  if (requestPayload.method === "tools/call") {
    const toolName =
      typeof requestPayload.params?.name === "string"
        ? requestPayload.params.name
        : null;

    if (!toolName) {
      return {
        status: 400,
        payload: createJsonRpcErrorPayload(
          requestPayload.id,
          -32602,
          "Missing tool name.",
        ),
      };
    }

    const result = await locals.container.mcpService.callTool(
      toolName,
      requestPayload.params?.arguments,
      {
        organizationId: authContext.organizationId,
        allowedAppIds: authContext.allowedAppIds,
        scopes: authContext.scopes,
      },
    );

    if (!result) {
      return {
        status: 400,
        payload: createJsonRpcErrorPayload(
          requestPayload.id,
          -32602,
          `Unknown tool: ${toolName}`,
        ),
      };
    }

    return {
      payload: {
        jsonrpc: "2.0",
        id: requestPayload.id,
        result,
      },
    };
  }

  return {
    status: 404,
    payload: createJsonRpcErrorPayload(
      requestPayload.id,
      -32601,
      "Method not found",
    ),
  };
};

export const GET: RequestHandler = async (event) => {
  if (!validateOrigin(event.request, event.url.origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const authContext = await resolveAuthContext(
    event.request,
    event.locals,
    () => event.getClientAddress(),
  );

  if (!authContext) {
    return createUnauthorizedResponse(event.url.origin);
  }

  const sessionValidation = validateSession(event.request, authContext);

  if (!sessionValidation.ok) {
    return sessionValidation.response;
  }

  const sessionId = sessionValidation.session.id;

  return createSseResponse(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            serializeSseEvent({
              id: genId("mcpe"),
              data: "",
            }),
          ),
        );
        controller.enqueue(
          encoder.encode(
            serializeSseEvent({
              id: genId("mcpe"),
              event: "ready",
              data: JSON.stringify({
                sessionId,
              }),
            }),
          ),
        );

        const keepalive = setInterval(() => {
          controller.enqueue(
            encoder.encode(
              serializeSseEvent({
                id: genId("mcpe"),
                event: "ping",
                data: JSON.stringify({
                  at: new Date().toISOString(),
                }),
              }),
            ),
          );
        }, keepaliveIntervalMs);

        const close = () => {
          clearInterval(keepalive);
          try {
            controller.close();
          } catch {
            // Stream is already closed.
          }
        };

        event.request.signal.addEventListener("abort", close, { once: true });
      },
    }),
    {
      [sessionHeaderName]: sessionId,
    },
  );
};

export const POST: RequestHandler = async (event) => {
  if (!validateOrigin(event.request, event.url.origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const authContext = await resolveAuthContext(
    event.request,
    event.locals,
    () => event.getClientAddress(),
  );

  if (!authContext) {
    return createUnauthorizedResponse(event.url.origin);
  }

  let payload: unknown;

  try {
    payload = await event.request.json();
  } catch {
    return createJsonRpcError(null, -32700, "Parse error", 400);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return createJsonRpcError(null, -32600, "Invalid request", 400);
  }

  const requestPayload = payload as {
    jsonrpc?: string;
    id?: string | number | null;
    method?: string;
    params?: Record<string, unknown>;
  };

  if (
    requestPayload.jsonrpc !== "2.0" ||
    typeof requestPayload.method !== "string"
  ) {
    return createJsonRpcError(
      requestPayload.id ?? null,
      -32600,
      "Invalid request",
      400,
    );
  }

  if (requestPayload.method !== "initialize") {
    const sessionValidation = validateSession(event.request, authContext);

    if (!sessionValidation.ok) {
      return sessionValidation.response;
    }
  }

  if (requestPayload.id === undefined) {
    return new Response(null, { status: 202 });
  }

  const execution = await executeRequest(
    {
      id: requestPayload.id,
      method: requestPayload.method,
      params: requestPayload.params,
    },
    authContext,
    event.locals,
  );

  if (wantsSseResponse(event.request)) {
    return createSingleEventSseResponse(execution.payload, execution.headers);
  }

  return createJsonResponse(
    execution.payload,
    execution.status ?? 200,
    execution.headers,
  );
};

export const DELETE: RequestHandler = async (event) => {
  if (!validateOrigin(event.request, event.url.origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const authContext = await resolveAuthContext(
    event.request,
    event.locals,
    () => event.getClientAddress(),
  );

  if (!authContext) {
    return createUnauthorizedResponse(event.url.origin);
  }

  const sessionValidation = validateSession(event.request, authContext);

  if (!sessionValidation.ok) {
    return sessionValidation.response;
  }

  mcpSessions.delete(sessionValidation.session.id);

  return new Response(null, {
    status: 204,
  });
};
