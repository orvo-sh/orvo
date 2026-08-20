import { z } from "zod";

const getBillingStateInputSchema = z.object({});
const createBillingPortalInputSchema = z.object({
  appId: z.string().trim().startsWith("app_").max(64),
});
const startFreeTrialInputSchema = z.object({
  plan: z.enum(["starter", "pro"]),
});
const updateBillingEmailInputSchema = z.object({
  billingEmail: z.string().trim().email().max(255),
});
const queueBillingNotificationInputSchema = z.object({
  kind: z.string().trim().min(1).max(64),
  payload: z.record(z.string(), z.string()),
});

export {
  createBillingPortalInputSchema,
  getBillingStateInputSchema,
  queueBillingNotificationInputSchema,
  startFreeTrialInputSchema,
  updateBillingEmailInputSchema,
};
