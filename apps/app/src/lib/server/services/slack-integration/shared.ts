import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { formatDuration } from "@repo/utils";

const hashSlackOauthState = (state: string) =>
  createHash("sha256").update(state).digest("base64url");

const verifySlackSignature = (input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  signingSecret: string;
  now?: Date;
}) => {
  if (!input.timestamp || !input.signature || !input.signingSecret)
    return false;

  const timestamp = Number(input.timestamp);
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs((input.now ?? new Date()).getTime() / 1000 - timestamp) > 300
  ) {
    return false;
  }

  const expected = `v0=${createHmac("sha256", input.signingSecret)
    .update(`v0:${input.timestamp}:${input.rawBody}`)
    .digest("hex")}`;
  const actualBuffer = Buffer.from(input.signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
};

const escapeSlackText = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const formatValue = (value: unknown) =>
  typeof value === "number"
    ? Number.isInteger(value)
      ? `${value}`
      : value.toFixed(2)
    : "No data";

const buildSlackMessage = (
  payload: Record<string, unknown>,
  eventType:
    | "heartbeat.missed"
    | "heartbeat.recovered"
    | "alert.opened"
    | "alert.renotified"
    | "alert.resolved"
    | "destination.test",
  destinationId: string,
) => {
  const app = payload.app as { name?: string } | undefined;
  const incident = payload.incident as
    | { id?: string; url?: string }
    | undefined;
  const heartbeat = payload.heartbeat as
    | {
        name?: string;
        expectedEverySeconds?: number;
        graceSeconds?: number;
        lastCheckInAt?: string | null;
      }
    | undefined;
  const rule = payload.rule as
    | {
        name?: string;
        signalType?: string;
        comparator?: string;
        threshold?: number;
        windowMinutes?: number;
      }
    | undefined;
  const evaluation = payload.evaluation as
    | { observedValue?: number | null }
    | undefined;

  if (eventType === "destination.test") {
    return {
      text: `Orvo is connected to ${app?.name ?? "your app"}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:wave: *Orvo is connected*\nNotifications for *${escapeSlackText(app?.name ?? "your app")}* can now appear here.`,
          },
        },
      ],
    };
  }

  const isResolved =
    eventType === "alert.resolved" || eventType === "heartbeat.recovered";
  const title = rule?.name ?? heartbeat?.name ?? "Orvo incident";
  const statusLabel = isResolved
    ? ":white_check_mark: Resolved"
    : eventType === "alert.renotified"
      ? ":rotating_light: Still firing"
      : ":rotating_light: Incident opened";
  const details = rule
    ? [
        `Signal: *${escapeSlackText(rule.signalType?.replaceAll("_", " ") ?? "Unknown")}*`,
        `Observed: *${formatValue(evaluation?.observedValue)}*`,
        `Threshold: *${escapeSlackText(`${rule.comparator ?? "?"} ${formatValue(rule.threshold)}`)}* over ${rule.windowMinutes ?? "?"}m`,
      ]
    : [
        `Expected every: *${formatDuration(heartbeat?.expectedEverySeconds ?? 0)}*`,
        `Grace period: *${formatDuration(heartbeat?.graceSeconds ?? 0)}*`,
        `Last check-in: *${escapeSlackText(heartbeat?.lastCheckInAt ?? "Never")}*`,
      ];
  const elements: Array<Record<string, unknown>> = [];

  if (!isResolved && incident?.id) {
    elements.push({
      type: "button",
      text: { type: "plain_text", text: "Resolve" },
      style: "primary",
      action_id: "incident_resolve",
      value: JSON.stringify({ destinationId, incidentId: incident.id }),
      confirm: {
        title: { type: "plain_text", text: "Resolve incident?" },
        text: {
          type: "mrkdwn",
          text: "This marks the incident as resolved in Orvo.",
        },
        confirm: { type: "plain_text", text: "Resolve" },
        deny: { type: "plain_text", text: "Cancel" },
      },
    });
  }

  if (incident?.url) {
    elements.push({
      type: "button",
      text: { type: "plain_text", text: "View in Orvo" },
      action_id: "incident_view",
      url: incident.url,
    });
  }

  return {
    text: `${isResolved ? "Resolved" : "Incident"}: ${title}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${statusLabel}\n*${escapeSlackText(title)}*\n${escapeSlackText(app?.name ?? "Orvo app")}\n\n${details.join("\n")}`,
        },
      },
      ...(elements.length > 0 ? [{ type: "actions", elements }] : []),
    ],
  };
};

export { buildSlackMessage, hashSlackOauthState, verifySlackSignature };
