import { z } from "zod";

const mcpOauthClientInputSchema = z.object({
  clientId: z.string().trim().min(1),
});

const upsertMcpOauthGrantInputSchema = mcpOauthClientInputSchema.extend({
  organizationId: z.string().trim().min(1),
});

const listMcpConnectionsInputSchema = z.object({});

const revokeMcpConnectionInputSchema = z.object({
  id: z.string().trim().min(1),
});

export {
  listMcpConnectionsInputSchema,
  mcpOauthClientInputSchema,
  revokeMcpConnectionInputSchema,
  upsertMcpOauthGrantInputSchema,
};
