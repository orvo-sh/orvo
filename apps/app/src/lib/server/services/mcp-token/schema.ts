import { z } from "zod";

const mcpTokenScopeValues = [
  "app:read",
  "app:write",
  "logs:read",
  "traces:read",
  "metrics:read",
  "incidents:read",
  "incidents:write",
  "heartbeats:read",
  "heartbeats:write",
  "alerts:read",
  "alerts:write",
] as const;

const mcpTokenScopeSchema = z.enum(mcpTokenScopeValues);

const listMcpTokensInputSchema = z.object({
  includeRevoked: z.boolean().optional().default(true),
});

const createMcpTokenInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
  description: z.string().trim().max(240).optional().default(""),
  scopes: z
    .array(mcpTokenScopeSchema)
    .min(1)
    .max(mcpTokenScopeValues.length)
    .refine((value) => new Set(value).size === value.length, {
      message: "Scopes must be unique.",
    }),
  allowedAppIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(100)
    .refine((value) => new Set(value).size === value.length, {
      message: "Allowed apps must be unique.",
    }),
  expiresInDays: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .nullable()
    .optional()
    .default(null),
});

const revokeMcpTokenInputSchema = z.object({
  id: z.string().trim().min(1),
});

export {
  createMcpTokenInputSchema,
  listMcpTokensInputSchema,
  mcpTokenScopeSchema,
  mcpTokenScopeValues,
  revokeMcpTokenInputSchema,
};
