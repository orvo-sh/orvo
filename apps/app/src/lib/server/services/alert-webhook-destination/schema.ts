import { z } from "zod";

const alertWebhookDestinationIdSchema = z.string().trim().min(1);

const alertWebhookHeaderInputSchema = z.object({
  key: z.string().trim().min(1).max(255),
  value: z.string().trim().min(1).max(2000),
});

const alertWebhookDestinationInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
  url: z
    .string()
    .trim()
    .url()
    .refine(
      (value) => value.startsWith("http://") || value.startsWith("https://"),
      {
        message: "Webhook URL must use http or https.",
      },
    ),
  headers: z.array(alertWebhookHeaderInputSchema).max(20).default([]),
  isEnabled: z.boolean().default(true),
});

const createAlertWebhookDestinationInputSchema =
  alertWebhookDestinationInputSchema;

const updateAlertWebhookDestinationInputSchema =
  alertWebhookDestinationInputSchema.extend({
    id: alertWebhookDestinationIdSchema,
  });

const deleteAlertWebhookDestinationInputSchema =
  alertWebhookDestinationIdSchema;

const testAlertWebhookDestinationInputSchema = alertWebhookDestinationIdSchema;

export {
  alertWebhookDestinationIdSchema,
  alertWebhookDestinationInputSchema,
  alertWebhookHeaderInputSchema,
  createAlertWebhookDestinationInputSchema,
  deleteAlertWebhookDestinationInputSchema,
  testAlertWebhookDestinationInputSchema,
  updateAlertWebhookDestinationInputSchema,
};
