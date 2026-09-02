import { createUpdateNotificationDestination } from "$lib/server/services/notification-destination/methods/update-notification-destination";
import { createCompleteOauth } from "$lib/server/services/slack-integration/methods/complete-oauth";
import { createProcessAction } from "$lib/server/services/slack-integration/methods/process-action";
import { hashSlackOauthState } from "$lib/server/services/slack-integration/shared";
import { type DB } from "@repo/db";
import {
  member,
  notificationDestination,
  slackOauthState,
  user,
} from "@repo/db/schema";
import { Encryption } from "@repo/encryption";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  applyPostgresMigrations,
  createApp,
  createOrganization,
  createTestLogger,
  getTestDb,
  startPostgresContainer,
  stopPostgresContainer,
  truncatePostgresTables,
} from "../../helpers";

describe("Slack integration", () => {
  let container: Awaited<ReturnType<typeof startPostgresContainer>>;
  let db: DB;

  beforeAll(async () => {
    container = await startPostgresContainer();
    db = getTestDb(container.getConnectionUri());
    await applyPostgresMigrations(db);
  });

  beforeEach(async () => {
    await truncatePostgresTables(db, [
      "slack_oauth_state",
      "notification_destination",
      "app",
      "member",
      '"user"',
      "organization",
    ]);
    await db.insert(user).values({
      id: "user_slack",
      name: "Slack installer",
      email: "slack@example.com",
      emailVerified: true,
    });
    const organization = await createOrganization(db, {
      id: "org_slack",
      slug: "slack-org",
    });
    await db.insert(member).values({
      id: "member_slack",
      organizationId: organization.id,
      userId: "user_slack",
      role: "owner",
      createdAt: new Date(),
    });
    await createApp(db, { id: "app_slack", organizationId: organization.id });
  });

  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    if (container) await stopPostgresContainer(container);
  });

  test("completes OAuth once and encrypts the incoming webhook", async () => {
    await db.insert(slackOauthState).values({
      stateHash: hashSlackOauthState("valid-state"),
      appId: "app_slack",
      organizationId: "org_slack",
      userId: "user_slack",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          ok: true,
          team: { id: "T123", name: "Orvo" },
          incoming_webhook: {
            channel: "#alerts",
            channel_id: "C123",
            url: "https://hooks.slack.com/services/T/B/secret",
          },
        }),
      ),
    );

    const result = await createCompleteOauth({
      db,
      encryption: new Encryption({ secret: "test-secret" }),
      logger: createTestLogger() as never,
      config: {
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: "https://app.orvo.sh/api/integrations/slack/callback",
      },
    })({ code: "code", state: "valid-state" });

    expect(result).toMatchObject({
      success: true,
      data: { appId: "app_slack" },
    });
    const destination = await db.query.notificationDestination.findFirst();
    expect(destination).toMatchObject({
      kind: "slack",
      appId: "app_slack",
      slackTeamId: "T123",
      slackChannelName: "alerts",
    });
    expect(destination?.slackWebhookUrlEncrypted).not.toContain(
      "hooks.slack.com",
    );

    const replay = await createCompleteOauth({
      db,
      encryption: new Encryption({ secret: "test-secret" }),
      logger: createTestLogger() as never,
      config: {
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: "https://app.orvo.sh/api/integrations/slack/callback",
      },
    })({ code: "code", state: "valid-state" });
    expect(replay.success).toBe(false);
  });

  test("rejects invalid and expired OAuth state", async () => {
    await db.insert(slackOauthState).values({
      stateHash: hashSlackOauthState("expired-state"),
      appId: "app_slack",
      organizationId: "org_slack",
      userId: "user_slack",
      expiresAt: new Date(Date.now() - 60_000),
    });
    const completeOauth = createCompleteOauth({
      db,
      encryption: new Encryption({ secret: "test-secret" }),
      logger: createTestLogger() as never,
      config: {
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: "https://app.orvo.sh/api/integrations/slack/callback",
      },
    });

    expect(
      (await completeOauth({ code: "code", state: "missing" })).success,
    ).toBe(false);
    expect(
      (await completeOauth({ code: "code", state: "expired-state" })).success,
    ).toBe(false);
  });

  test("handles a Slack OAuth error without storing a destination", async () => {
    await db.insert(slackOauthState).values({
      stateHash: hashSlackOauthState("denied-state"),
      appId: "app_slack",
      organizationId: "org_slack",
      userId: "user_slack",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await createCompleteOauth({
      db,
      encryption: new Encryption({ secret: "test-secret" }),
      logger: createTestLogger() as never,
      config: {
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: "https://app.orvo.sh/api/integrations/slack/callback",
      },
    })({ code: "", state: "denied-state", oauthError: "access_denied" });

    expect(result).toMatchObject({
      success: false,
      error: "Slack connection was cancelled.",
      appId: "app_slack",
    });
    expect(await db.query.notificationDestination.findFirst()).toBeUndefined();
  });

  test("updates Slack destination settings without replacing its connection", async () => {
    await db.insert(notificationDestination).values({
      id: "ntds_slack",
      appId: "app_slack",
      name: "Slack · alerts",
      kind: "slack",
      slackTeamId: "T123",
      slackTeamName: "Orvo",
      slackChannelId: "C123",
      slackChannelName: "alerts",
      slackWebhookUrlEncrypted: "encrypted-webhook",
      isEnabled: true,
    });
    const prepareDestinationInput = vi.fn();

    const result = await createUpdateNotificationDestination({
      db,
      logger: createTestLogger() as never,
      prepareDestinationInput: prepareDestinationInput as never,
    })(
      {
        id: "ntds_slack",
        kind: "slack",
        name: "Primary Slack",
        isEnabled: false,
      },
      {
        appId: "app_slack",
        organizationId: "org_slack",
        userId: "user_slack",
      },
    );

    expect(result).toMatchObject({ success: true });
    expect(prepareDestinationInput).not.toHaveBeenCalled();
    expect(
      await db.query.notificationDestination.findFirst({
        where: ({ id }, { eq }) => eq(id, "ntds_slack"),
      }),
    ).toMatchObject({
      name: "Primary Slack",
      isEnabled: false,
      slackTeamId: "T123",
      slackChannelId: "C123",
      slackWebhookUrlEncrypted: "encrypted-webhook",
    });
  });

  test("resolves only incidents belonging to the Slack destination app", async () => {
    await db.insert(notificationDestination).values({
      id: "ntds_slack",
      appId: "app_slack",
      name: "Slack · alerts",
      kind: "slack",
      slackTeamId: "T123",
      isEnabled: true,
    });
    const resolveIncident = vi
      .fn()
      .mockResolvedValue({ success: true, data: undefined });
    const processAction = createProcessAction({
      db,
      logger: createTestLogger() as never,
      incidentService: { resolveIncident } as never,
    });
    const payload = {
      type: "block_actions",
      team: { id: "T123" },
      user: { id: "U123", username: "decie" },
      actions: [
        {
          action_id: "incident_resolve",
          value: JSON.stringify({
            destinationId: "ntds_slack",
            incidentId: "inc_1",
          }),
        },
      ],
    };

    expect(await processAction(payload)).toMatchObject({ success: true });
    expect(resolveIncident).toHaveBeenCalledWith("inc_1", {
      appId: "app_slack",
      metadata: expect.objectContaining({
        source: "slack",
        slackUserId: "U123",
      }),
    });

    resolveIncident.mockClear();
    expect(
      await processAction({ ...payload, team: { id: "T_OTHER" } }),
    ).toMatchObject({ success: false });
    expect(resolveIncident).not.toHaveBeenCalled();
  });
});
