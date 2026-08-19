import { z } from "zod";

const mcpOauthClientInputSchema = z.object({
  clientId: z.string().trim().min(1),
});

const upsertMcpOauthGrantInputSchema = mcpOauthClientInputSchema.extend({
  organizationId: z.string().trim().min(1),
});

export { mcpOauthClientInputSchema, upsertMcpOauthGrantInputSchema };
