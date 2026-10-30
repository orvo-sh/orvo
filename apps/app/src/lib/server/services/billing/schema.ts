import { z } from "zod";

const getBillingStateInputSchema = z.object({});
const createBillingPortalInputSchema = z.object({
  appId: z.string().trim().startsWith("app_").max(64),
  flow: z.enum(["payment_method_update", "manage"]).default("manage"),
  returnPath: z.string().startsWith("/").max(8192).optional(),
});
const startFreeTrialInputSchema = z.object({
  plan: z.literal("pro"),
});
const completeBillingFlowInputSchema = createBillingPortalInputSchema
  .pick({
    appId: true,
    returnPath: true,
  })
  .extend({ paymentMethodUpdated: z.boolean().default(false) });
const updateBillingEmailInputSchema = z.object({
  billingEmail: z.string().trim().email().max(255),
});
const updateOverageSettingsInputSchema = z.object({
  ingestOverageEnabled: z.boolean(),
  ingestOverageBudgetCents: z.number().int().min(100).max(1_000_000).nullable(),
  scoutOverageEnabled: z.boolean(),
  scoutOverageBudgetCents: z.number().int().min(100).max(1_000_000).nullable(),
});
const queueBillingNotificationInputSchema = z.object({
  kind: z.string().trim().min(1).max(64),
  payload: z.record(z.string(), z.string()),
});

export {
  completeBillingFlowInputSchema,
  createBillingPortalInputSchema,
  getBillingStateInputSchema,
  queueBillingNotificationInputSchema,
  startFreeTrialInputSchema,
  updateBillingEmailInputSchema,
  updateOverageSettingsInputSchema,
};
