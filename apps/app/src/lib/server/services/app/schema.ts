import { z } from "zod";

const getAppInputSchema = z.object({
  id: z.string().trim().min(1),
});

const createAppInputSchema = z.object({
  name: z.string().trim().min(2).max(64),
  logo: z.string().trim().min(1).optional(),
});

const updateAppInputSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(2).max(64),
  logo: z.string().trim().min(1).nullable().optional(),
});

export { createAppInputSchema, getAppInputSchema, updateAppInputSchema };
