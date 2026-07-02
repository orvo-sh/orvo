import { z } from "zod";

const getIngestionKeyInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
});

const listIngestionKeysInputSchema = z.object({
  includeRevoked: z.boolean().optional().default(false),
});

const createIngestionKeyInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
});

const revokeIngestionKeyInputSchema = z.object({
  id: z.string().trim().min(1),
});

export {
  createIngestionKeyInputSchema,
  getIngestionKeyInputSchema,
  listIngestionKeysInputSchema,
  revokeIngestionKeyInputSchema,
};
