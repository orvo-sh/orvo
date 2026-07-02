import { z } from "zod";

const getAppInputSchema = z.object({
  id: z.string().trim().min(1),
});

const createAppInputSchema = z.object({
  name: z.string().trim().min(2).max(64),
});

const updateAppInputSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(2).max(64),
});

export { createAppInputSchema, getAppInputSchema, updateAppInputSchema };
