import {
  buildSlackMessage,
  verifySlackSignature,
} from "$lib/server/services/slack-integration/shared";
import { createSendToDestination } from "$lib/server/services/notification-delivery/shared";
import { Encryption } from "@repo/encryption";
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";

describe("Slack integration helpers", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("verifies a current Slack request signature", () => {
    const timestamp = "1777804800";
    const rawBody = "payload=%7B%22type%22%3A%22block_actions%22%7D";
    const signature = `v0=${createHmac("sha256", "signing-secret")
      .update(`v0:${timestamp}:${rawBody}`)
      .digest("hex")}`;

    expect(
      verifySlackSignature({
        rawBody,
        timestamp,
        signature,
        signingSecret: "signing-secret",
        now: new Date("2026-05-03T10:40:00.000Z"),
      }),
    ).toBe(true);
  });

  test("rejects expired and invalid Slack request signatures", () => {
    expect(
      verifySlackSignature({
        rawBody: "payload={}",
        timestamp: "1777820000",
        signature: "v0=invalid",
        signingSecret: "signing-secret",
        now: new Date("2026-05-03T10:40:00.000Z"),
      }),
    ).toBe(false);
  });

  test("builds incident actions without exposing telemetry payloads", () => {
    const message = buildSlackMessage(
      {
        app: { id: "app_1", name: "Production" },
        rule: {
          name: "High error rate",
          signalType: "error_rate",
          comparator: "gt",
          threshold: 5,
          windowMinutes: 5,
        },
        incident: {
          id: "inc_1",
          url: "https://app.orvo.sh/a/app_1/incidents/inc_1",
        },
        evaluation: { observedValue: 8.7 },
        rawLogs: ["must not appear"],
      },
      "alert.opened",
      "ntds_1",
    );

    expect(message.text).toBe("Incident: High error rate");
    expect(JSON.stringify(message)).toContain("incident_resolve");
    expect(JSON.stringify(message)).toContain("View in Orvo");
    expect(JSON.stringify(message)).not.toContain("must not appear");
  });

  test("reports Slack webhook failures to the delivery retry pipeline", async () => {
    const encryption = new Encryption({ secret: "test-secret" });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("channel_not_found", { status: 404 })),
    );

    const result = await createSendToDestination({
      encryption,
      email: null,
    })(
      {
        id: "ntds_1",
        kind: "slack",
        slackWebhookUrlEncrypted: encryption.encrypt(
          "https://hooks.slack.com/services/T/B/secret",
        ),
      } as never,
      { app: { name: "Production" } },
      "destination.test",
    );

    expect(result).toMatchObject({
      success: false,
      httpStatus: 404,
      errorMessage: "channel_not_found",
    });
  });
});
