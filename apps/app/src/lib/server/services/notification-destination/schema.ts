import { z } from "zod";

const destinationIdSchema = z.string().trim().min(1);

const notificationHeaderSchema = z.object({
  key: z.string().trim().min(1).max(100),
  value: z.string().trim().min(1).max(1000),
});

const webhookDestinationInputSchema = z.object({
  kind: z.literal("webhook"),
  name: z.string().trim().min(2).max(64),
  url: z.url().max(2048),
  headers: z.array(notificationHeaderSchema).max(20).default([]),
  isEnabled: z.boolean().default(true),
});

const emailDestinationInputSchema = z.object({
  kind: z.literal("email"),
  name: z.string().trim().min(2).max(64),
  recipients: z.array(z.email().max(320)).max(50).default([]),
  isEnabled: z.boolean().default(true),
});

const createNotificationDestinationInputSchema = z.discriminatedUnion("kind", [
  webhookDestinationInputSchema,
  emailDestinationInputSchema,
]);

const updateNotificationDestinationInputSchema = z.discriminatedUnion("kind", [
  webhookDestinationInputSchema.extend({
    id: destinationIdSchema,
  }),
  emailDestinationInputSchema.extend({
    id: destinationIdSchema,
  }),
]);

const deleteNotificationDestinationInputSchema = destinationIdSchema;
const testNotificationDestinationInputSchema = destinationIdSchema;

export {
  createNotificationDestinationInputSchema,
  deleteNotificationDestinationInputSchema,
  destinationIdSchema,
  emailDestinationInputSchema,
  notificationHeaderSchema,
  testNotificationDestinationInputSchema,
  updateNotificationDestinationInputSchema,
  webhookDestinationInputSchema,
};
