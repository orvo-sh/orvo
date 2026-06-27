import { Instrument } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { member, notificationDestination } from "@repo/db/schema";
import { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { NotificationDeliveryService } from "../notification-delivery";

@Instrument({ prefix: "notificationDestination" })
class NotificationDestinationService {
  private logger: Logger;

  constructor(
    private db: DB,
    logger: Logger,
    private encryption: Encryption,
    private notificationDeliveryService: NotificationDeliveryService,
  ) {
    this.logger = logger.child("NotificationDestinationService");
  }

  async listNotificationDestinations(context: { appId: string }) {
    this.logger.info(
      "listNotificationDestinations: listing notification destinations",
      {
        context,
      },
    );

    try {
      const destinations = await this.db.query.notificationDestination.findMany(
        {
          where: eq(notificationDestination.appId, context.appId),
          orderBy: [asc(notificationDestination.name)],
        },
      );

      return ok({
        destinations: destinations.map((destination) => ({
          ...destination,
          headers: destination.webhookHeadersEncrypted
            ? (JSON.parse(
                this.encryption.decrypt(destination.webhookHeadersEncrypted),
              ) as Array<{ key: string; value: string }>)
            : [],
        })),
      });
    } catch (error) {
      this.logger.error(
        "listNotificationDestinations: failed to list notification destinations",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to load notification destinations.");
    }
  }

  async getDefaultEmailRecipients(context: { organizationId: string }) {
    this.logger.info(
      "getDefaultEmailRecipients: loading default email recipients",
      {
        context,
      },
    );

    try {
      const members = await this.db.query.member.findMany({
        where: and(
          eq(member.organizationId, context.organizationId),
          inArray(member.role, ["owner"]),
        ),
        with: {
          user: true,
        },
      });

      return ok({
        recipients: [
          ...new Set(
            members
              .map((item) =>
                item.user?.emailVerified ? item.user.email.toLowerCase() : null,
              )
              .filter((email): email is string => Boolean(email)),
          ),
        ],
      });
    } catch (error) {
      this.logger.error(
        "getDefaultEmailRecipients: failed to load default email recipients",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to load default email recipients.");
    }
  }

  async createNotificationDestination(
    input: z.infer<typeof createNotificationDestinationInputSchema>,
    context: { appId: string; organizationId: string; userId: string },
  ) {
    this.logger.info(
      "createNotificationDestination: creating notification destination",
      {
        input,
        context,
      },
    );

    const validated = createNotificationDestinationInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const destination = await this.prepareDestinationInput(
        validated.data,
        context.organizationId,
      );
      if (!destination.success) {
        return destination;
      }

      const id = genId("ntds");

      await this.db.insert(notificationDestination).values({
        id,
        appId: context.appId,
        name: validated.data.name,
        kind: validated.data.kind,
        isEnabled: validated.data.isEnabled,
        webhookUrl: destination.data.webhookUrl,
        webhookHeadersEncrypted: destination.data.webhookHeadersEncrypted,
        emailRecipients: destination.data.emailRecipients,
        createdBy: context.userId,
        updatedBy: context.userId,
      });

      return ok({ id });
    } catch (error) {
      this.logger.error(
        "createNotificationDestination: failed to create notification destination",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to create notification destination.");
    }
  }

  async updateNotificationDestination(
    input: z.infer<typeof updateNotificationDestinationInputSchema>,
    context: { appId: string; organizationId: string; userId: string },
  ) {
    this.logger.info(
      "updateNotificationDestination: updating notification destination",
      {
        input,
        context,
      },
    );

    const validated = updateNotificationDestinationInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const existing = await this.db.query.notificationDestination.findFirst({
        where: and(
          eq(notificationDestination.id, validated.data.id),
          eq(notificationDestination.appId, context.appId),
        ),
      });

      if (!existing) {
        return err("Notification destination not found.");
      }

      const destination = await this.prepareDestinationInput(
        validated.data,
        context.organizationId,
      );
      if (!destination.success) {
        return destination;
      }

      await this.db
        .update(notificationDestination)
        .set({
          name: validated.data.name,
          kind: validated.data.kind,
          isEnabled: validated.data.isEnabled,
          webhookUrl: destination.data.webhookUrl,
          webhookHeadersEncrypted: destination.data.webhookHeadersEncrypted,
          emailRecipients: destination.data.emailRecipients,
          updatedBy: context.userId,
        })
        .where(eq(notificationDestination.id, existing.id));

      return ok(undefined);
    } catch (error) {
      this.logger.error(
        "updateNotificationDestination: failed to update notification destination",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to update notification destination.");
    }
  }

  async deleteNotificationDestination(
    input: z.infer<typeof deleteNotificationDestinationInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info(
      "deleteNotificationDestination: deleting notification destination",
      {
        input,
        context,
      },
    );

    const validated = deleteNotificationDestinationInputSchema.safeParse(input);
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
          ),
        );

      return ok(undefined);
    } catch (error) {
      this.logger.error(
        "deleteNotificationDestination: failed to delete notification destination",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to delete notification destination.");
    }
  }

  async testNotificationDestination(
    input: z.infer<typeof testNotificationDestinationInputSchema>,
    context: { appId: string },
  ) {
    this.logger.info(
      "testNotificationDestination: testing notification destination",
      {
        input,
        context,
      },
    );

    const validated = testNotificationDestinationInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const destination = await this.db.query.notificationDestination.findFirst(
        {
          where: and(
            eq(notificationDestination.id, validated.data),
            eq(notificationDestination.appId, context.appId),
          ),
        },
      );

      if (!destination) {
        return err("Notification destination not found.");
      }

      const attempt = await this.notificationDeliveryService.createTestDelivery(
        destination,
        context,
      );

      if (!attempt.success) {
        return err(attempt.errorMessage ?? "Test delivery failed.");
      }

      return ok(undefined);
    } catch (error) {
      this.logger.error(
        "testNotificationDestination: failed to test notification destination",
        error instanceof Error ? error : undefined,
      );
      return err("Failed to test notification destination.");
    }
  }

  private async prepareDestinationInput(
    input:
      | z.infer<typeof createNotificationDestinationInputSchema>
      | z.infer<typeof updateNotificationDestinationInputSchema>,
    organizationId: string,
  ) {
    if (input.kind === "webhook") {
      return ok({
        webhookUrl: input.url,
        webhookHeadersEncrypted: this.encryption.encrypt(
          JSON.stringify(input.headers),
        ),
        emailRecipients: [],
      });
    }

    const recipients =
      input.recipients.length > 0
        ? input.recipients
        : await (async () => {
            const defaultRecipients = await this.getDefaultEmailRecipients({
              organizationId,
            });
            return defaultRecipients.success
              ? defaultRecipients.data.recipients
              : [];
          })();

    if (recipients.length === 0) {
      return err("Add at least one email recipient.");
    }

    return ok({
      webhookUrl: null,
      webhookHeadersEncrypted: null,
      emailRecipients: recipients,
    });
  }
}

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
  NotificationDestinationService,
  testNotificationDestinationInputSchema,
  updateNotificationDestinationInputSchema,
};
