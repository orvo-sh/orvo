import { z } from "zod";

import { timeFilterSchema } from "../shared/time-filter";

const createHostInstallSessionInputSchema = z.object({
  dockerEnabled: z.boolean().default(false),
});

const getHostInstallBundleInputSchema = z.object({
  token: z.string().trim().min(1),
});

const getHostsInputSchema = z.object({
  time: timeFilterSchema.default({
    kind: "preset",
    preset: "last_24_hours",
  }),
  search: z.string().trim().max(200).default(""),
});

const getHostDetailInputSchema = z.object({
  hostId: z.string().trim().min(1),
  time: timeFilterSchema.default({
    kind: "preset",
    preset: "last_hour",
  }),
  bucketCount: z.number().int().min(10).max(120).default(48),
});

export {
  createHostInstallSessionInputSchema,
  getHostDetailInputSchema,
  getHostInstallBundleInputSchema,
  getHostsInputSchema,
};
