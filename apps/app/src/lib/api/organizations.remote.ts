import { command, getRequestEvent } from "$app/server";
import { createOrganizationActivationInputSchema } from "$lib/server/services/organization-activation.service";
import { createUploadUrlInputSchema } from "$lib/server/services/upload.service";

export const createOrganizationLogoUploadUrlCommand = command(
  createUploadUrlInputSchema,
  (input) => {
    const event = getRequestEvent();

    return event.locals.container.uploadService.createUploadUrl(input);
  },
);

export const createOrganizationActivationCommand = command(
  createOrganizationActivationInputSchema,
  (input) => {
    const event = getRequestEvent();

    return event.locals.container.organizationActivationService.createOrganizationActivation(
      input,
    );
  },
);
