import type { DB } from "@repo/db";
import { alertDeliveryAttempt, alertWebhookDestination } from "@repo/db/schema";
import { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

class AlertWebhookDestinationService {
  private logger: Logger;

  constructor(
    private db: DB,
    logger: Logger,
    private encryption: Encryption,
  ) {
    this.logger = logger.child("AlertWebhookDestinationService");
  }

  async getAlertWebhookDestinations(context: { appId: string }) {
    this.logger.info(
      "getAlertWebhookDestinations: getting alert webhook destinations",
      { context },
    );

    try {
      const destinations = await this.db.query.alertWebhookDestination.findMany(
        {
          where: eq(alertWebhookDestination.appId, context.appId),
          orderBy: [asc(alertWebhookDestination.name)],
        },
      );

      return ok({
        destinations: destinations.map((destination) => ({
          ...destination,
          headers: JSON.parse(
            this.encryption.decrypt(destination.headersEncrypted),
          ),
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
      const id = genId("alds");

      await this.db.insert(alertWebhookDestination).values({
        id,
        appId: context.appId,
        name: validated.data.name,
        url: validated.data.url,
        headersEncrypted: this.encryption.encrypt(
          JSON.stringify(validated.data.headers),
        ),
        isEnabled: validated.data.isEnabled,
        createdBy: context.userId,
        updatedBy: context.userId,
      });

      return ok({ id });
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
      const existing = await this.db.query.alertWebhookDestination.findFirst({
        where: and(
          eq(alertWebhookDestination.id, validated.data.id),
          eq(alertWebhookDestination.appId, context.appId),
        ),
      });

      if (!existing) {
        return err("Webhook destination not found.");
      }

      await this.db
        .update(alertWebhookDestination)
        .set({
          name: validated.data.name,
          url: validated.data.url,
          headersEncrypted: this.encryption.encrypt(
            JSON.stringify(validated.data.headers),
          ),
          isEnabled: validated.data.isEnabled,
          updatedBy: context.userId,
        })
        .where(eq(alertWebhookDestination.id, existing.id));

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
        .delete(alertWebhookDestination)
        .where(
          and(
            eq(alertWebhookDestination.id, validated.data),
            eq(alertWebhookDestination.appId, context.appId),
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
      const destination = await this.db.query.alertWebhookDestination.findFirst(
        {
          where: and(
            eq(alertWebhookDestination.id, validated.data),
            eq(alertWebhookDestination.appId, context.appId),
          ),
        },
      );

      if (!destination) {
        return err("Webhook destination not found.");
      }

      const payload = {
        type: "alert.test",
        timestamp: new Date().toISOString(),
        appId: context.appId,
        destination: {
          id: destination.id,
          name: destination.name,
        },
      };
      const headers = JSON.parse(
        this.encryption.decrypt(destination.headersEncrypted),
      ) as Array<{
        key: string;
        value: string;
      }>;
      const response = await fetch(destination.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...Object.fromEntries(
            headers.map((header) => [header.key, header.value]),
          ),
        },
        body: JSON.stringify(payload),
      });
      const body = await response.text().catch(() => "");
      const deliveryId = genId("aldv");
      const now = new Date();

      await this.db.transaction(async (tx) => {
        await tx.insert(alertDeliveryAttempt).values({
          id: deliveryId,
          appId: context.appId,
          destinationId: destination.id,
          eventType: "test",
          payload,
          status: response.ok ? "succeeded" : "failed",
          attemptNumber: 1,
          nextAttemptAt: now,
          lastAttemptAt: now,
          deliveredAt: response.ok ? now : null,
          httpStatus: response.status,
          errorMessage: response.ok
            ? null
            : body.slice(0, 2000) || "Webhook request failed.",
        });

        await tx
          .update(alertWebhookDestination)
          .set({
            lastTestedAt: now,
          })
          .where(eq(alertWebhookDestination.id, destination.id));
      });

      if (!response.ok) {
        return err(`Webhook test failed with status ${response.status}.`);
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
