import { createUpdateNotificationDestination } from "$lib/server/services/notification-destination/methods/update-notification-destination";
import { createCompleteOauth } from "$lib/server/services/slack-integration/methods/complete-oauth";
import { createCreateConnectUrl } from "$lib/server/services/slack-integration/methods/create-connect-url";
import { createProcessAction } from "$lib/server/services/slack-integration/methods/process-action";
import { createIngestEvent } from "$lib/server/services/slack-integration/methods/ingest-event";
import { createListChannels } from "$lib/server/services/slack-integration/methods/list-channels";
import {
  createCompleteLink,
  createCreateLinkUrl,
  hashLinkState,
} from "$lib/server/services/slack-integration/methods/link-user";
import { hashSlackOauthState } from "$lib/server/services/slack-integration/shared";
import { createUpdateChannel } from "$lib/server/services/slack-integration/methods/update-channel";
import { type DB } from "@repo/db";
import {
  chat,
  member,
  notificationDestination,
  slackOauthState,
  slackEvent,
  slackLinkState,
  slackScoutThread,
  slackUserLink,
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
      "slack_event",
      "slack_link_state",
      "slack_scout_thread",
      "slack_user_link",
      "notification_destination",
      "chat",
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

  test("completes workspace OAuth once and encrypts the bot token", async () => {
    await db.insert(slackOauthState).values({
      stateHash: hashSlackOauthState("valid-state"),
      appId: "app_slack",
      organizationId: "org_slack",
      userId: "user_slack",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Response.json({
          ok: true,
          access_token: "xoxb-test-token",
          bot_user_id: "U_BOT",
          scope:
            "app_mentions:read,chat:write,channels:history,channels:read,groups:history,groups:read,im:history",
          team: { id: "T123", name: "Orvo" },
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
      slackChannelId: null,
      slackChannelName: null,
      slackBotUserId: "U_BOT",
      slackScopes: [
        "app_mentions:read",
        "chat:write",
        "channels:history",
        "channels:read",
        "groups:history",
        "groups:read",
        "im:history",
      ],
    });
    expect(destination?.slackBotTokenEncrypted).not.toContain(
      "xoxb-test-token",
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

  test("requests workspace bot scopes without incoming webhooks", async () => {
    const result = await createCreateConnectUrl({
      db,
      logger: createTestLogger() as never,
      config: {
        clientId: "client-id",
        redirectUri: "https://app.orvo.sh/api/integrations/slack/callback",
      },
    })({
      appId: "app_slack",
      organizationId: "org_slack",
      userId: "user_slack",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const scopes = new URL(result.data.url).searchParams
      .get("scope")
      ?.split(",");
    expect(scopes).toEqual(
      expect.arrayContaining([
        "app_mentions:read",
        "chat:write",
        "channels:read",
        "groups:read",
        "im:history",
      ]),
    );
    expect(scopes).not.toContain("incoming-webhook");
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

  test("lists joined Slack channels and selects one for notifications", async () => {
    const encryption = new Encryption({ secret: "test-secret" });
    await db.insert(notificationDestination).values({
      id: "ntds_slack",
      appId: "app_slack",
      name: "Slack · Orvo",
      kind: "slack",
      slackTeamId: "T123",
      slackTeamName: "Orvo",
      slackBotTokenEncrypted: encryption.encrypt("xoxb-test-token"),
      slackBotUserId: "U_BOT",
      isEnabled: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Response.json({
          ok: true,
          channels: [
            { id: "C_GENERAL", name: "general", is_member: true },
            { id: "C_PRIVATE", name: "private", is_member: false },
            {
              id: "C_ARCHIVED",
              name: "archived",
              is_member: true,
              is_archived: true,
            },
          ],
          response_metadata: { next_cursor: "" },
        }),
      ),
    );

    const dependencies = {
      db,
      encryption,
      logger: createTestLogger() as never,
    };
    expect(
      await createListChannels(dependencies)({ appId: "app_slack" }),
    ).toMatchObject({
      success: true,
      data: { channels: [{ id: "C_GENERAL", name: "general" }] },
    });
    expect(
      await createUpdateChannel(dependencies)(
        { channelId: "C_GENERAL" },
        { appId: "app_slack", userId: "user_slack" },
      ),
    ).toMatchObject({ success: true });
    expect(await db.query.notificationDestination.findFirst()).toMatchObject({
      name: "Slack · #general",
      slackChannelId: "C_GENERAL",
      slackChannelName: "general",
    });
  });

  test("deduplicates Slack mention events before they are queued", async () => {
    const ingestEvent = createIngestEvent({
      db,
      logger: createTestLogger() as never,
    });
    const payload = {
      type: "event_callback",
      event_id: "Ev123",
      team_id: "T123",
      event: {
        type: "app_mention",
        user: "U123",
        text: "<@UBOT> investigate checkout",
        channel: "C123",
        ts: "123.456",
      },
    };

    expect(await ingestEvent(payload)).toMatchObject({
      success: true,
      data: { queued: true, eventId: "Ev123" },
    });
    expect(await ingestEvent(payload)).toMatchObject({
      success: true,
      data: { queued: true, eventId: "Ev123" },
    });
    expect(await db.select().from(slackEvent)).toHaveLength(1);
  });

  test("queues DMs and unaddressed replies in an existing Scout thread", async () => {
    const ingestEvent = createIngestEvent({
      db,
      logger: createTestLogger() as never,
    });

    expect(
      await ingestEvent({
        type: "event_callback",
        event_id: "EvDm",
        team_id: "T123",
        event: {
          type: "message",
          user: "U123",
          text: "What happened to checkout?",
          channel: "D123",
          channel_type: "im",
          ts: "124.001",
        },
      }),
    ).toMatchObject({
      success: true,
      data: { queued: true, eventId: "EvDm" },
    });

    await db.insert(chat).values({
      id: "chat_slack",
      organizationId: "org_slack",
      appId: "app_slack",
      createdBy: "user_slack",
    });
    await db.insert(slackScoutThread).values({
      id: "slst_1",
      teamId: "T123",
      channelId: "C123",
      threadTs: "123.456",
      chatId: "chat_slack",
      appId: "app_slack",
    });

    expect(
      await ingestEvent({
        type: "event_callback",
        event_id: "EvReply",
        team_id: "T123",
        event: {
          type: "message",
          user: "U123",
          text: "Can you check the database too?",
          channel: "C123",
          channel_type: "channel",
          ts: "124.002",
          thread_ts: "123.456",
        },
      }),
    ).toMatchObject({
      success: true,
      data: { queued: true, eventId: "EvReply" },
    });

    expect(
      await ingestEvent({
        type: "event_callback",
        event_id: "EvReplyForSomeoneElse",
        team_id: "T123",
        event: {
          type: "message",
          user: "U123",
          text: "<@U456> can you take a look?",
          channel: "C123",
          channel_type: "channel",
          ts: "124.003",
          thread_ts: "123.456",
        },
      }),
    ).toMatchObject({
      success: true,
      data: { queued: false, eventId: "EvReplyForSomeoneElse" },
    });

    expect(
      await ingestEvent({
        type: "event_callback",
        event_id: "EvUnrelated",
        team_id: "T123",
        event: {
          type: "message",
          user: "U123",
          text: "Unrelated channel conversation",
          channel: "C_OTHER",
          channel_type: "channel",
          ts: "124.004",
        },
      }),
    ).toMatchObject({
      success: true,
      data: { queued: false, eventId: "EvUnrelated" },
    });
    expect(await db.select().from(slackEvent)).toHaveLength(2);
  });

  test("links a Slack identity only to an organization member", async () => {
    const createLinkUrl = createCreateLinkUrl({
      db,
      logger: createTestLogger() as never,
      origin: "https://app.orvo.sh",
    });
    const link = await createLinkUrl({
      teamId: "T123",
      slackUserId: "U123",
      organizationId: "org_slack",
      appId: "app_slack",
      eventId: "Ev123",
    });
    expect(link.success).toBe(true);
    if (!link.success) return;
    const token = new URL(link.data.url).searchParams.get("token")!;
    expect(
      await db.query.slackLinkState.findFirst({
        where: ({ stateHash }, { eq }) => eq(stateHash, hashLinkState(token)),
      }),
    ).toBeDefined();

    const result = await createCompleteLink({
      db,
      logger: createTestLogger() as never,
    })({ token }, { userId: "user_slack" });
    expect(result).toMatchObject({
      success: true,
      data: { eventId: "Ev123", appId: "app_slack" },
    });
    expect(await db.select().from(slackUserLink)).toMatchObject([
      { teamId: "T123", slackUserId: "U123", userId: "user_slack" },
    ]);
    expect(await db.select().from(slackLinkState)).toHaveLength(0);
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

  test("queues an incident investigation in the notification thread", async () => {
    await db.insert(notificationDestination).values({
      id: "ntds_slack",
      appId: "app_slack",
      name: "Slack · alerts",
      kind: "slack",
      slackTeamId: "T123",
      slackBotUserId: "U_BOT",
      isEnabled: true,
    });
    const result = await createProcessAction({
      db,
      logger: createTestLogger() as never,
      incidentService: { resolveIncident: vi.fn() } as never,
    })({
      type: "block_actions",
      team: { id: "T123" },
      user: { id: "U123" },
      channel: { id: "C123" },
      message: { ts: "123.456" },
      actions: [
        {
          action_id: "scout_investigate",
          value: JSON.stringify({
            destinationId: "ntds_slack",
            incidentId: "inc_1",
          }),
        },
      ],
    });

    expect(result).toMatchObject({
      success: true,
      data: { scoutJob: { kind: "message" } },
    });
    expect(await db.select().from(slackEvent)).toHaveLength(1);
  });
});
