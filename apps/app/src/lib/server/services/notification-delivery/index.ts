import { Instrument } from "$lib/instrumentation";
import type { Email } from "$lib/server/email";
import type { DB } from "@repo/db";
import {
  app,
  notificationDelivery,
  notificationDestination,
  notificationEventType,
} from "@repo/db/schema";
import { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { formatDuration, genId } from "@repo/utils";
import { and, asc, eq, lte } from "drizzle-orm";

@Instrument({ prefix: "notificationDelivery" })
class NotificationDeliveryService {
  private logger: Logger;

  constructor(
    private db: DB,
    logger: Logger,
    private encryption: Encryption,
    private email: Nullable<Email>,
  ) {
    this.logger = logger.child("NotificationDeliveryService");
  }

  async processDueDeliveries(limit = 50) {
    this.logger.info(
      "processDueDeliveries: processing due notification deliveries",
      {
        limit,
      },
    );

    try {
      const dueDeliveries = await this.db.query.notificationDelivery.findMany({
        where: and(
          eq(notificationDelivery.status, "pending"),
          lte(notificationDelivery.nextAttemptAt, new Date()),
        ),
        orderBy: [asc(notificationDelivery.nextAttemptAt)],
        limit,
      });

      for (const delivery of dueDeliveries) {
        const destination =
          await this.db.query.notificationDestination.findFirst({
            where: eq(notificationDestination.id, delivery.destinationId),
          });

        await this.processDelivery(delivery, destination ?? null);
      }

      return { processed: dueDeliveries.length };
    } catch (error) {
      this.logger.error(
        "processDueDeliveries: failed to process due notification deliveries",
        error instanceof Error ? error : undefined,
      );
      throw error;
    }
  }

  async createTestDelivery(
    destination: typeof notificationDestination.$inferSelect,
    context: { appId: string },
  ) {
    this.logger.info("createTestDelivery: creating test delivery", {
      destinationId: destination.id,
      context,
    });

    const currentApp = await this.db.query.app.findFirst({
      where: eq(app.id, context.appId),
    });
    const payload = {
      type: "destination.test",
      timestamp: new Date().toISOString(),
      appId: context.appId,
      app: {
        id: context.appId,
        name: currentApp?.name ?? "Orvo app",
      },
      destination: {
        id: destination.id,
        name: destination.name,
        kind: destination.kind,
      },
    } satisfies Record<string, unknown>;
    const now = new Date();
    const id = genId("ntdl");

    try {
      const attempt = await this.sendToDestination(
        destination,
        payload,
        "destination.test",
      );

      await this.db.insert(notificationDelivery).values({
        id,
        appId: context.appId,
        destinationId: destination.id,
        sourceKind: "heartbeat",
        sourceId: destination.id,
        eventType: "destination.test",
        payload,
        status: attempt.success ? "succeeded" : "failed",
        attemptNumber: 1,
        nextAttemptAt: now,
        lastAttemptAt: now,
        deliveredAt: attempt.success ? now : null,
        httpStatus: attempt.httpStatus,
        errorMessage: attempt.errorMessage,
      });

      return attempt;
    } catch (error) {
      this.logger.error(
        "createTestDelivery: failed to create test delivery",
        error instanceof Error ? error : undefined,
      );
      throw error;
    }
  }

  private async processDelivery(
    delivery: typeof notificationDelivery.$inferSelect,
    destination: typeof notificationDestination.$inferSelect | null,
  ) {
    const now = new Date();
    const attemptNumber = delivery.attemptNumber + 1;

    if (!destination || !destination.isEnabled) {
      await this.db
        .update(notificationDelivery)
        .set({
          status: "failed",
          attemptNumber,
          lastAttemptAt: now,
          errorMessage: destination
            ? "Destination is disabled."
            : "Destination not found.",
        })
        .where(eq(notificationDelivery.id, delivery.id));
      return;
    }

    const result = await this.sendToDestination(
      destination,
      delivery.payload,
      delivery.eventType,
    );

    if (result.success) {
      await this.db
        .update(notificationDelivery)
        .set({
          status: "succeeded",
          attemptNumber,
          lastAttemptAt: now,
          deliveredAt: now,
          httpStatus: result.httpStatus,
          errorMessage: null,
        })
        .where(eq(notificationDelivery.id, delivery.id));
      return;
    }

    const retryMinutes = deliveryRetryMinutes[attemptNumber - 1] ?? null;

    await this.db
      .update(notificationDelivery)
      .set({
        status: retryMinutes === null ? "failed" : "pending",
        attemptNumber,
        nextAttemptAt:
          retryMinutes === null
            ? now
            : new Date(now.getTime() + retryMinutes * 60_000),
        lastAttemptAt: now,
        httpStatus: result.httpStatus,
        errorMessage: result.errorMessage,
      })
      .where(eq(notificationDelivery.id, delivery.id));
  }

  private async sendToDestination(
    destination: typeof notificationDestination.$inferSelect,
    payload: Record<string, unknown>,
    eventType: (typeof notificationEventType.enumValues)[number],
  ) {
    if (destination.kind === "webhook") {
      return this.sendWebhook(destination, payload);
    }

    return this.sendEmailDelivery(destination, payload, eventType);
  }

  private async sendWebhook(
    destination: typeof notificationDestination.$inferSelect,
    payload: Record<string, unknown>,
  ) {
    try {
      const headers = destination.webhookHeadersEncrypted
        ? (JSON.parse(
            this.encryption.decrypt(destination.webhookHeadersEncrypted),
          ) as Array<{ key: string; value: string }>)
        : [];
      const response = await fetch(destination.webhookUrl ?? "", {
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

      if (response.ok) {
        return {
          success: true as const,
          httpStatus: response.status,
          errorMessage: null,
        };
      }

      return {
        success: false as const,
        httpStatus: response.status,
        errorMessage: body.slice(0, 2000) || "Webhook request failed.",
      };
    } catch (error) {
      return {
        success: false as const,
        httpStatus: null,
        errorMessage:
          error instanceof Error ? error.message : "Webhook request failed.",
      };
    }
  }

  private async sendEmailDelivery(
    destination: typeof notificationDestination.$inferSelect,
    payload: Record<string, unknown>,
    eventType: (typeof notificationEventType.enumValues)[number],
  ) {
    if (!this.email) {
      return {
        success: false as const,
        httpStatus: null,
        errorMessage: "Email delivery is not configured.",
      };
    }

    const recipients = destination.emailRecipients.filter(Boolean);
    if (recipients.length === 0) {
      return {
        success: false as const,
        httpStatus: null,
        errorMessage: "Email destination has no recipients.",
      };
    }

    const emailContent = buildEmailContent(payload, eventType);
    if (!emailContent) {
      return {
        success: false as const,
        httpStatus: null,
        errorMessage: "Unsupported email notification type.",
      };
    }

    try {
      for (const recipient of recipients) {
        await sendEmailContent(this.email, recipient, emailContent);
      }

      return {
        success: true as const,
        httpStatus: null,
        errorMessage: null,
      };
    } catch (error) {
      return {
        success: false as const,
        httpStatus: null,
        errorMessage:
          error instanceof Error ? error.message : "Email request failed.",
      };
    }
  }
}

const deliveryRetryMinutes = [1, 5, 15];

const buildEmailContent = (
  payload: Record<string, unknown>,
  eventType: (typeof notificationEventType.enumValues)[number],
) => {
  const heartbeat = payload.heartbeat as
    | {
        name?: string;
        expectedEverySeconds?: number;
        graceSeconds?: number;
        lastCheckInAt?: string | null;
      }
    | undefined;
  const app = payload.app as { name?: string } | undefined;

  if (!heartbeat?.name || !app?.name) {
    if (eventType === "destination.test") {
      const destination = payload.destination as { name?: string } | undefined;
      if (!app?.name || (!destination?.name && !heartbeat?.name)) {
        return null;
      }

      return {
        subject: destination?.name
          ? `Notification destination test: ${destination.name}`
          : `Heartbeat test alert: ${heartbeat?.name}`,
        template: "destination-test" as const,
        props: {
          appName: app.name,
          destinationName: destination?.name ?? heartbeat?.name ?? "Heartbeat monitor",
        },
      };
    }

    return null;
  }

  if (eventType === "heartbeat.missed") {
    return {
      subject: `Heartbeat missed: ${heartbeat.name}`,
      template: "heartbeat-missed" as const,
      props: {
        appName: app.name,
        heartbeatName: heartbeat.name,
        expectedEvery: formatDuration(heartbeat.expectedEverySeconds ?? 0),
        grace: formatDuration(heartbeat.graceSeconds ?? 0),
        lastCheckInAt: heartbeat.lastCheckInAt ?? "Never",
      },
    };
  }

  if (eventType === "heartbeat.recovered") {
    return {
      subject: `Heartbeat recovered: ${heartbeat.name}`,
      template: "heartbeat-recovered" as const,
      props: {
        appName: app.name,
        heartbeatName: heartbeat.name,
        expectedEvery: formatDuration(heartbeat.expectedEverySeconds ?? 0),
        recoveredAt:
          typeof payload.timestamp === "string"
            ? payload.timestamp
            : new Date().toISOString(),
      },
    };
  }

  const rule = payload.rule as
    | {
        name?: string;
        signalType?: string;
        comparator?: string;
        threshold?: number;
        windowMinutes?: number;
      }
    | undefined;
  const incident = payload.incident as
    | {
        entity?: {
          type?: string;
          id?: string;
          name?: string | null;
        };
      }
    | undefined;
  const evaluation = payload.evaluation as
    | {
        observedValue?: number | null;
        windowStartAt?: string;
        windowEndAt?: string;
      }
    | undefined;

  if (app?.name && rule?.name) {
    const entityLabel =
      incident?.entity?.name ??
      incident?.entity?.id ??
      (incident?.entity?.type === "app" ? app.name : "Unknown entity");
    const observedValue =
      typeof evaluation?.observedValue === "number"
        ? formatObservedValue(evaluation.observedValue)
        : "No data";
    const threshold =
      typeof rule.threshold === "number"
        ? `${formatComparator(rule.comparator)} ${formatObservedValue(rule.threshold)}`
        : "Unknown threshold";
    const windowLabel =
      typeof rule.windowMinutes === "number" ? `${rule.windowMinutes}m` : "Unknown";

    if (eventType === "alert.opened") {
      return {
        subject: `Alert opened: ${rule.name}`,
        template: "threshold-alert-opened" as const,
        props: {
          appName: app.name,
          entityName: entityLabel,
          observedValue,
          ruleName: rule.name,
          signalType: formatSignalType(rule.signalType),
          threshold,
          window: windowLabel,
        },
      };
    }

    if (eventType === "alert.renotified") {
      return {
        subject: `Alert still firing: ${rule.name}`,
        template: "threshold-alert-renotified" as const,
        props: {
          appName: app.name,
          entityName: entityLabel,
          observedValue,
          ruleName: rule.name,
          signalType: formatSignalType(rule.signalType),
          threshold,
          window: windowLabel,
        },
      };
    }

    if (eventType === "alert.resolved") {
      return {
        subject: `Alert resolved: ${rule.name}`,
        template: "threshold-alert-resolved" as const,
        props: {
          appName: app.name,
          entityName: entityLabel,
          observedValue,
          resolvedAt:
            typeof payload.timestamp === "string"
              ? payload.timestamp
              : new Date().toISOString(),
          ruleName: rule.name,
          signalType: formatSignalType(rule.signalType),
        },
      };
    }
  }

  if (eventType === "destination.test") {
    const destination = payload.destination as { name?: string } | undefined;
    return {
      subject: destination?.name
        ? `Notification destination test: ${destination.name}`
        : `Heartbeat test alert: ${heartbeat.name}`,
      template: "destination-test" as const,
      props: {
        appName: app.name,
        destinationName: destination?.name ?? heartbeat.name,
      },
    };
  }

  return null;
};

const sendEmailContent = async (
  email: Email,
  recipient: string,
  content:
    | {
        subject: string;
        template: "destination-test";
        props: {
          appName: string;
          destinationName: string;
        };
      }
    | {
        subject: string;
        template: "heartbeat-missed";
        props: {
          appName: string;
          heartbeatName: string;
          expectedEvery: string;
          grace: string;
          lastCheckInAt: string;
        };
      }
    | {
        subject: string;
        template: "heartbeat-recovered";
        props: {
          appName: string;
          heartbeatName: string;
          expectedEvery: string;
          recoveredAt: string;
        };
      }
    | {
        subject: string;
        template: "threshold-alert-opened";
        props: {
          appName: string;
          entityName: string;
          observedValue: string;
          ruleName: string;
          signalType: string;
          threshold: string;
          window: string;
        };
      }
    | {
        subject: string;
        template: "threshold-alert-renotified";
        props: {
          appName: string;
          entityName: string;
          observedValue: string;
          ruleName: string;
          signalType: string;
          threshold: string;
          window: string;
        };
      }
    | {
        subject: string;
        template: "threshold-alert-resolved";
        props: {
          appName: string;
          entityName: string;
          observedValue: string;
          resolvedAt: string;
          ruleName: string;
          signalType: string;
        };
      },
) => {
  switch (content.template) {
    case "destination-test":
      return email.sendEmail({
        to: recipient,
        subject: content.subject,
        template: content.template,
        props: content.props,
      });
    case "heartbeat-missed":
      return email.sendEmail({
        to: recipient,
        subject: content.subject,
        template: content.template,
        props: content.props,
      });
    case "heartbeat-recovered":
      return email.sendEmail({
        to: recipient,
        subject: content.subject,
        template: content.template,
        props: content.props,
      });
    case "threshold-alert-opened":
      return email.sendEmail({
        to: recipient,
        subject: content.subject,
        template: content.template,
        props: content.props,
      });
    case "threshold-alert-renotified":
      return email.sendEmail({
        to: recipient,
        subject: content.subject,
        template: content.template,
        props: content.props,
      });
    case "threshold-alert-resolved":
      return email.sendEmail({
        to: recipient,
        subject: content.subject,
        template: content.template,
        props: content.props,
      });
  }
};

const formatComparator = (comparator?: string) => {
  switch (comparator) {
    case "gt":
      return ">";
    case "gte":
      return ">=";
    case "lt":
      return "<";
    case "lte":
      return "<=";
    default:
      return "?";
  }
};

const formatObservedValue = (value: number) =>
  Number.isInteger(value) ? `${value}` : value.toFixed(2);

const formatSignalType = (signalType?: string) =>
  signalType
    ? signalType
        .split("_")
        .map((part) => part.toUpperCase() === "P95" || part.toUpperCase() === "P99"
          ? part.toUpperCase()
          : part)
        .join(" ")
    : "Unknown signal";

export { NotificationDeliveryService };
