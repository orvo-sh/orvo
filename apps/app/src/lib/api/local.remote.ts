import { command, getRequestEvent } from "$app/server";
import { mode } from "$lib/server/mode";
import { initializeLocalInputSchema } from "$lib/server/services/local";
import { err } from "@repo/utils";

const initializeLocalCommand = command(
  initializeLocalInputSchema,
  async (input) => {
    const event = getRequestEvent();
    if (mode !== "local" || !event.locals.auth) {
      return err("A signed-in local user is required.");
    }

    return event.locals.container.localService.initializeOwner(input, {
      userId: event.locals.auth.user.id,
    });
  },
);

export { initializeLocalCommand };
