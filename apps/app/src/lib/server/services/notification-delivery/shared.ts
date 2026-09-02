import type { Email, EmailInput } from "$lib/server/email";
import { recordError } from "$lib/instrumentation";
import {
  notificationDestination,
  notificationEventType,
} from "@repo/db/schema";
import type { Encryption } from "@repo/encryption";
import { formatDuration } from "@repo/utils";

import { buildSlackMessage } from "../slack-integration/shared";

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
          destinationName:
            destination?.name ?? heartbeat?.name ?? "Heartbeat monitor",
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
      typeof rule.windowMinutes === "number"
        ? `${rule.windowMinutes}m`
        : "Unknown";

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
  content: Omit<EmailInput, "to" | "from">,
) =>
  email.sendEmail({
    to: recipient,
    ...content,
  } as EmailInput);

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
        .map((part) =>
          part.toUpperCase() === "P95" || part.toUpperCase() === "P99"
            ? part.toUpperCase()
            : part,
        )
        .join(" ")
    : "Unknown signal";

const createSendToDestination =
  ({ encryption, email }: { encryption: Encryption; email: Nullable<Email> }) =>
  async (
    destination: typeof notificationDestination.$inferSelect,
    payload: Record<string, unknown>,
    eventType: (typeof notificationEventType.enumValues)[number],
  ) => {
    if (destination.kind === "slack") {
      try {
        if (!destination.slackWebhookUrlEncrypted) {
          return {
            success: false as const,
            httpStatus: null,
            errorMessage: "Slack destination is missing its webhook URL.",
          };
        }

        const response = await fetch(
          encryption.decrypt(destination.slackWebhookUrlEncrypted),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            signal: AbortSignal.timeout(10_000),
            body: JSON.stringify(
              buildSlackMessage(payload, eventType, destination.id),
            ),
          },
        );
        const body = await response.text().catch(() => "");

        return response.ok
          ? {
              success: true as const,
              httpStatus: response.status,
              errorMessage: null,
            }
          : {
              success: false as const,
              httpStatus: response.status,
              errorMessage:
                body.slice(0, 2000) || "Slack webhook request failed.",
            };
      } catch (error) {
        recordError(error);
        return {
          success: false as const,
          httpStatus: null,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Slack webhook request failed.",
        };
      }
    }

    if (destination.kind === "webhook") {
      try {
        const headers = destination.webhookHeadersEncrypted
          ? (JSON.parse(
              encryption.decrypt(destination.webhookHeadersEncrypted),
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
        recordError(error);
        return {
          success: false as const,
          httpStatus: null,
          errorMessage:
            error instanceof Error ? error.message : "Webhook request failed.",
        };
      }
    }

    if (!email) {
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
        await sendEmailContent(email, recipient, emailContent);
      }

      return {
        success: true as const,
        httpStatus: null,
        errorMessage: null,
      };
    } catch (error) {
      recordError(error);
      return {
        success: false as const,
        httpStatus: null,
        errorMessage:
          error instanceof Error ? error.message : "Email request failed.",
      };
    }
  };

export { createSendToDestination, deliveryRetryMinutes };
