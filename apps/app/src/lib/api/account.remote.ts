import { command, getRequestEvent } from "$app/server";
import { createUploadUrlInputSchema } from "$lib/server/services/upload";

export const createProfileImageUploadUrlCommand = command(
  createUploadUrlInputSchema,
  (input) => {
    const event = getRequestEvent();

    return event.locals.container.uploadService.createUploadUrl(input);
  },
);
