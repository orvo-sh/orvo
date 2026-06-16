import { building, dev } from "$app/environment";
import { createServerContainer } from "$lib/server/container";
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

export const handle = async ({ event, resolve }) => {
  const startTime = Date.now();
  const requestId = genId("req");
  const themeMode = resolveThemeMode(event.cookies.get(themeModeCookieName));

  const route = event.route.id ?? event.url.pathname;
  event.tracing.root.updateName(`${event.request.method} ${route}`);
  event.tracing.root.setAttribute("http.route", route);

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

  const response = await svelteKitHandler({
    event,
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

  logger.info("HTTP request handled", {
    method: event.request.method,
    url: event.url.pathname,
    status: response.status,
    duration: `${Date.now() - startTime}ms`,
  });

  return response;
};
