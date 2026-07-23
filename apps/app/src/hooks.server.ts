import { building, dev } from "$app/environment";
import { createServerContainer } from "$lib/server/container";
import { ensureWorkersStarted } from "$lib/server/workers";
import {
  getThemeDocumentAttributes,
  resolveThemeMode,
  themeModeCookieName,
} from "$lib/theme/theme";
import { Logger } from "@repo/logger";
import { genId } from "@repo/utils";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { loggerProvider } from "./instrumentation.server";

const baseLogger = new Logger("Orvo", { pretty: dev, loggerProvider });
void ensureWorkersStarted(baseLogger);

const oauthFormEndpoints = new Set([
  "/api/auth/oauth2/introspect",
  "/api/auth/oauth2/revoke",
  "/api/auth/oauth2/token",
]);
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const formContentTypes = new Set([
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
]);

const withDefaultMcpResource = (request: Request) => {
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.pathname !== "/api/auth/oauth2/authorize" ||
    url.searchParams.has("resource")
  ) {
    return request;
  }

  url.searchParams.set("resource", `${url.origin}/api/mcp`);

  return new Request(url, request);
};

export const handle = async ({ event, resolve }) => {
  const contentType =
    event.request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() ?? "";
  const requestOrigin = event.request.headers.get("origin");
  const isForbiddenCrossSiteForm =
    unsafeMethods.has(event.request.method) &&
    formContentTypes.has(contentType) &&
    requestOrigin !== event.url.origin &&
    !oauthFormEndpoints.has(event.url.pathname);

  if (isForbiddenCrossSiteForm) {
    const message = `Cross-site ${event.request.method} form submissions are forbidden`;

    if (event.request.headers.get("accept") === "application/json") {
      return Response.json({ message }, { status: 403 });
    }

    return new Response(message, { status: 403 });
  }

  const requestId = genId("req");
  const themeMode = resolveThemeMode(event.cookies.get(themeModeCookieName));

  const logger = baseLogger.child("Orvo", {
    requestId,
    method: event.request.method,
    url: event.url.pathname,
  });

  event.locals.container = createServerContainer(logger);

  event.tracing.root.setAttribute("orvo.request_id", requestId);
  event.tracing.root.setAttribute("http.request.method", event.request.method);
  event.tracing.root.setAttribute("url.path", event.url.pathname);

  const { authService } = event.locals.container;
  const session = await authService.api.getSession({
    headers: event.request.headers,
  });

  if (session) {
    event.locals.auth = {
      session: session.session,
      user: session.user,
    };
  }

  const authRequest = withDefaultMcpResource(event.request);
  const authEvent =
    authRequest === event.request ? event : { ...event, request: authRequest };
  const response = await svelteKitHandler({
    event: authEvent,
    resolve: (event) =>
      resolve(event, {
        transformPageChunk: ({ html }) =>
          html.replace(
            '<html lang="en">',
            `<html lang="en"${getThemeDocumentAttributes(themeMode)}>`,
          ),
      }),
    auth: authService,
    building,
  });

  return response;
};
