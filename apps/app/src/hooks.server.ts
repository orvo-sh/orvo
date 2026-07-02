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

export const handle = async ({ event, resolve }) => {

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

  return response;
};
