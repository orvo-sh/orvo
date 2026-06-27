import { z } from "zod";

const createOrganizationActivationInputSchema = z.object({
  organizationId: z.string().trim().min(1),
});

export { createOrganizationActivationInputSchema };
