import type { DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { NotificationDeliveryService } from "./notification-delivery.service";

class AlertWebhookDestinationService {
  private logger: Logger;

  constructor(
    private db: DB,
    logger: Logger,
    private encryption: Encryption,
    private notificationDeliveryService: NotificationDeliveryService,
  ) {
    this.logger = logger.child("AlertWebhookDestinationService");
  }

  async getAlertWebhookDestinations(context: { appId: string }) {
    this.logger.info(
      "getAlertWebhookDestinations: getting alert webhook destinations",
      { context },
    );

    try {
      const destinations = await this.db.query.notificationDestination.findMany(
        {
          where: and(
            eq(notificationDestination.appId, context.appId),
            eq(notificationDestination.kind, "webhook"),
          ),
          orderBy: [asc(notificationDestination.name)],
        },
      );

      return ok({
        destinations: destinations.map((destination) => ({
          id: destination.id,
          appId: destination.appId,
          name: destination.name,
          url: destination.webhookUrl ?? "",
          headers: destination.webhookHeadersEncrypted
            ? JSON.parse(
                this.encryption.decrypt(destination.webhookHeadersEncrypted),
              )
            : [],
          isEnabled: destination.isEnabled,
          createdBy: destination.createdBy,
          updatedBy: destination.updatedBy,
          createdAt: destination.createdAt,
          updatedAt: destination.updatedAt,
        })),
      });
    } catch (error) {
      this.logger.error(
        "getAlertWebhookDestinations: failed to get alert webhook destinations",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to get webhook destinations.");
    }
  }

  async createAlertWebhookDestination(
    input: z.infer<typeof createAlertWebhookDestinationInputSchema>,
    context: { appId: string; userId: string },
  ) {
    this.logger.info(
      "createAlertWebhookDestination: creating alert webhook destination",
      {
        input,
        context,
      },
    );

    const validated = createAlertWebhookDestinationInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const result =
        await this.db
          .insert(notificationDestination)
          .values({
            id: genId("alds"),
            appId: context.appId,
            name: validated.data.name,
            kind: "webhook",
            webhookUrl: validated.data.url,
            webhookHeadersEncrypted: this.encryption.encrypt(
              JSON.stringify(validated.data.headers),
            ),
            emailRecipients: [],
            isEnabled: validated.data.isEnabled,
            createdBy: context.userId,
            updatedBy: context.userId,
          })
          .returning({ id: notificationDestination.id });

      return ok({ id: result[0]!.id });
    } catch (error) {
      this.logger.error(
        "createAlertWebhookDestination: failed to create alert webhook destination",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to create webhook destination.");
    }
  }

  async updateAlertWebhookDestination(
    input: z.infer<typeof updateAlertWebhookDestinationInputSchema>,
    context: { appId: string; userId: string },
  ) {
    this.logger.info(
      "updateAlertWebhookDestination: updating alert webhook destination",
      {
        input,
        context,
      },
    );

    const validated = updateAlertWebhookDestinationInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const existing = await this.db.query.notificationDestination.findFirst({
        where: and(
          eq(notificationDestination.id, validated.data.id),
          eq(notificationDestination.appId, context.appId),
          eq(notificationDestination.kind, "webhook"),
        ),
      });

      if (!existing) {
        return err("Webhook destination not found.");
      }

      await this.db
        .update(notificationDestination)
        .set({
          name: validated.data.name,
          webhookUrl: validated.data.url,
          webhookHeadersEncrypted: this.encryption.encrypt(
            JSON.stringify(validated.data.headers),
          ),
          isEnabled: validated.data.isEnabled,
          updatedBy: context.userId,
        })
        .where(eq(notificationDestination.id, existing.id));

      return ok(undefined);
    } catch (error) {
      this.logger.error(
        "updateAlertWebhookDestination: failed to update alert webhook destination",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to update webhook destination.");
    }
  }

  async deleteAlertWebhookDestination(
    input: z.infer<typeof deleteAlertWebhookDestinationInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info(
      "deleteAlertWebhookDestination: deleting alert webhook destination",
      {
        input,
        context,
      },
    );

    const validated = deleteAlertWebhookDestinationInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      await this.db
        .delete(notificationDestination)
        .where(
          and(
            eq(notificationDestination.id, validated.data),
            eq(notificationDestination.appId, context.appId),
            eq(notificationDestination.kind, "webhook"),
          ),
        );

      return ok(undefined);
    } catch (error) {
      this.logger.error(
        "deleteAlertWebhookDestination: failed to delete alert webhook destination",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to delete webhook destination.");
    }
  }

  async testAlertWebhookDestination(
    input: z.infer<typeof testAlertWebhookDestinationInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info(
      "testAlertWebhookDestination: testing alert webhook destination",
      {
        input,
        context,
      },
    );

    const validated = testAlertWebhookDestinationInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const destination = await this.db.query.notificationDestination.findFirst(
        {
          where: and(
            eq(notificationDestination.id, validated.data),
            eq(notificationDestination.appId, context.appId),
            eq(notificationDestination.kind, "webhook"),
          ),
        },
      );

      if (!destination) {
        return err("Webhook destination not found.");
      }

      const attempt = await this.notificationDeliveryService.createTestDelivery(
        destination,
        context,
      );

      if (!attempt.success) {
        return err(attempt.errorMessage ?? "Webhook test failed.");
      }

      return ok(undefined);
    } catch (error) {
      this.logger.error(
        "testAlertWebhookDestination: failed to test alert webhook destination",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to test webhook destination.");
    }
  }
}

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
  AlertWebhookDestinationService,
  createAlertWebhookDestinationInputSchema,
  deleteAlertWebhookDestinationInputSchema,
  testAlertWebhookDestinationInputSchema,
  updateAlertWebhookDestinationInputSchema,
};
