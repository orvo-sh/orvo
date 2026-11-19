import { createRuleEditorController } from "$lib/alerts/rule-editor-controller";
import { NotificationDestinationService } from "$lib/server/services/notification-destination";
import { createNotificationDestinationInputSchema } from "$lib/notification-destination-schema";
import { Encryption } from "@repo/encryption";
import { createGetOnboardingProgress } from "$lib/server/services/onboarding/methods/get-onboarding-progress";
import { createCompleteOnboardingMilestone } from "$lib/server/services/onboarding/methods/complete-onboarding-milestone";
import { createEmptyAlertRuleForm } from "$lib/alerts";
import { AlertRuleService } from "$lib/server/services/alert-rule";
import { getDb, getDbClient, eq } from "@repo/db";
import { alertRule, user } from "@repo/db/schema";
import { AlertRuleDraftCleanupWorker } from "$lib/server/workers/alert-rule-draft-cleanup-worker";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createApp, createOrganization } from "../../helpers/app-fixtures";
import { createTestLogger } from "../../helpers/logger";
import {
  applyPostgresMigrations,
  startPostgresContainer,
  stopPostgresContainer,
} from "../../helpers/postgres";

let container: Awaited<ReturnType<typeof startPostgresContainer>>;
let service: AlertRuleService;
let db: ReturnType<typeof getDb>;
let context: { appId: string; userId: string };

beforeAll(async () => {
  container = await startPostgresContainer();
  db = getDb(container.getConnectionUri());
  await applyPostgresMigrations(db);
  const org = await createOrganization(db);
  const app = await createApp(db, { organizationId: org.id });
  await db.insert(user).values({
    id: "draft-test-user",
    name: "Draft test",
    email: "draft@example.com",
  });
  context = { appId: app.id, userId: "draft-test-user" };
  service = new AlertRuleService(db, createTestLogger() as never);
});

afterAll(async () => {
  if (container) {
    await getDbClient(container.getConnectionUri()).end();
    await stopPostgresContainer(container);
  }
});

test("draft persists, rejects activation until valid, and becomes active on save", async () => {
  const created = await service.createAlertRuleDraft(context);
  expect(created.success).toBe(true);
  if (!created.success) throw new Error(created.error);
  const id = created.data.id;
  const draft = await service.getAlertRule(id, context);
  expect(draft.success && draft.data.rule).toMatchObject({
    id,
    name: "",
    isDraft: true,
    isEnabled: false,
  });
  expect(
    (await service.setAlertRuleEnabled({ id, isEnabled: true }, context))
      .success,
  ).toBe(false);
  expect(
    (
      await service.updateAlertRule(
        {
          ...createEmptyAlertRuleForm(),
          metricName: "$request.error_rate",
          metricAggregation: "avg",
          metricType: "gauge",
          metricUnit: "%",
          id,
        },
        context,
      )
    ).success,
  ).toBe(false);
  expect(
    (
      await service.updateAlertRule(
        {
          ...createEmptyAlertRuleForm(),
          metricName: "$request.error_rate",
          metricAggregation: "avg",
          metricType: "gauge",
          metricUnit: "%",
          id,
          name: "High error rate",
        },
        context,
      )
    ).success,
  ).toBe(true);
  const saved = await service.getAlertRule(id, context);
  expect(saved.success && saved.data.rule).toMatchObject({
    id,
    name: "High error rate",
    isDraft: false,
    isEnabled: true,
  });

  await service.setAlertRuleEnabled({ id, isEnabled: false }, context);
  await service.updateAlertRule(
    {
      ...createEmptyAlertRuleForm(),
      metricName: "$request.error_rate",
      metricAggregation: "avg",
      metricType: "gauge",
      metricUnit: "%",
      id,
      name: "Renamed rule",
    },
    context,
  );
  const disabled = await service.getAlertRule(id, context);
  expect(disabled.success && disabled.data.rule).toMatchObject({
    isDraft: false,
    isEnabled: false,
  });
  const otherApp = { ...context, appId: "another-app" };
  expect((await service.getAlertRule(id, otherApp)).success).toBe(false);
});

const createDraft = async () => {
  const result = await service.createAlertRuleDraft(context);
  if (!result.success) throw new Error(result.error);
  return result.data.id;
};

test("provisional drafts are hidden from lists and counts but accessible in their editor", async () => {
  const id = await createDraft();
  expect((await service.getAlertRule(id, context)).success).toBe(true);
  const result = await service.getAlertRules(context);
  expect(
    result.success && result.data.rules.some((rule) => rule.id === id),
  ).toBe(false);
  await service.updateAlertRule(
    {
      ...createEmptyAlertRuleForm(),
      metricName: "$request.error_rate",
      metricAggregation: "avg",
      metricType: "gauge",
      metricUnit: "%",
      id,
      name: "Now visible",
    },
    context,
  );
  const saved = await service.getAlertRules(context);
  expect(saved.success && saved.data.rules.some((rule) => rule.id === id)).toBe(
    true,
  );
});

test("discard is idempotent, scoped to the creator and app, and protects saved rules", async () => {
  const id = await createDraft();
  await service.discardAlertRuleDraft(id, { ...context, appId: "another-app" });
  await service.discardAlertRuleDraft(id, {
    ...context,
    userId: "another-user",
  });
  expect((await service.getAlertRule(id, context)).success).toBe(true);
  await service.discardAlertRuleDraft(id, context);
  expect((await service.getAlertRule(id, context)).success).toBe(false);
  expect((await service.discardAlertRuleDraft(id, context)).success).toBe(true);
  const savedId = await createDraft();
  await service.updateAlertRule(
    {
      ...createEmptyAlertRuleForm(),
      metricName: "$request.error_rate",
      metricAggregation: "avg",
      metricType: "gauge",
      metricUnit: "%",
      id: savedId,
      name: "Saved elsewhere",
    },
    context,
  );
  await service.discardAlertRuleDraft(savedId, context);
  expect((await service.getAlertRule(savedId, context)).success).toBe(true);
});

test("daily cleanup removes only inactive empty drafts and preserves recently active or saved rules", async () => {
  const staleId = await createDraft();
  const activeId = await createDraft();
  const savedId = await createDraft();
  const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
  for (const id of [staleId, activeId, savedId]) {
    await db
      .update(alertRule)
      .set({ updatedAt: old })
      .where(eq(alertRule.id, id));
  }
  await service.touchAlertRuleDraft(activeId, context);
  await service.updateAlertRule(
    {
      ...createEmptyAlertRuleForm(),
      metricName: "$request.error_rate",
      metricAggregation: "avg",
      metricType: "gauge",
      metricUnit: "%",
      id: savedId,
      name: "Saved rule",
    },
    context,
  );
  await db
    .update(alertRule)
    .set({ updatedAt: old })
    .where(eq(alertRule.id, savedId));
  const worker = new AlertRuleDraftCleanupWorker(
    createTestLogger() as never,
    db,
  );
  await worker.execute();
  expect((await service.getAlertRule(staleId, context)).success).toBe(false);
  expect((await service.getAlertRule(activeId, context)).success).toBe(true);
  expect((await service.getAlertRule(savedId, context)).success).toBe(true);
});

test("a save racing with discard never reports a successful save of a missing rule", async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = await createDraft();
    const [saved] = await Promise.all([
      service.updateAlertRule(
        {
          ...createEmptyAlertRuleForm(),
          metricName: "$request.error_rate",
          metricAggregation: "avg",
          metricType: "gauge",
          metricUnit: "%",
          id,
          name: "Concurrent save",
        },
        context,
      ),
      service.discardAlertRuleDraft(id, context),
    ]);
    if (saved.success) {
      const result = await service.getAlertRule(id, context);
      expect(result.success && result.data.rule.isDraft).toBe(false);
    }
  }
});

test("create and update reject impossible error rates without saving them", async () => {
  const id = await createDraft();
  const condition = {
    ...createEmptyAlertRuleForm(),
    name: "Error percentage",
    metricName: "$request.error_rate",
    metricType: "gauge",
    metricAggregation: "avg" as const,
    metricUnit: "%",
  };
  for (const threshold of [-1, 100.01, 102102]) {
    for (const result of [
      await service.createAlertRule({ ...condition, threshold }, context),
      await service.updateAlertRule({ ...condition, id, threshold }, context),
    ]) {
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("between 0 and 100%");
    }
  }
  const draft = await service.getAlertRule(id, context);
  expect(draft.success && draft.data.rule.isDraft).toBe(true);
  for (const threshold of [0, 100]) {
    expect(
      (await service.updateAlertRule({ ...condition, id, threshold }, context))
        .success,
    ).toBe(true);
    const saved = await service.getAlertRule(id, context);
    expect(saved.success && saved.data.rule.threshold).toBe(threshold);
  }
});

test("onboarding discovery is per user, idempotent, and survives a new service instance", async () => {
  await db.insert(user).values({
    id: "onboarding-only-user",
    name: "Onboarding",
    email: "onboarding-only@example.com",
  });
  const context = { userId: "onboarding-only-user" };
  const logger = createTestLogger() as never;
  const getProgress = createGetOnboardingProgress({ db, logger });
  const complete = createCompleteOnboardingMilestone({ db, logger });
  expect(await getProgress(context)).toMatchObject({
    success: true,
    data: { milestones: [] },
  });
  await Promise.all([
    complete({ milestone: "first_alert_rule_created" }, context),
    complete({ milestone: "first_alert_rule_created" }, context),
  ]);
  const freshReader = createGetOnboardingProgress({ db, logger });
  expect(await freshReader({ userId: context.userId })).toMatchObject({
    success: true,
    data: { milestones: ["first_alert_rule_created"] },
  });
  await db.insert(user).values({
    id: "another-onboarding-user",
    name: "Another",
    email: "another-onboarding@example.com",
  });
  expect(
    await freshReader({ userId: "another-onboarding-user" }),
  ).toMatchObject({ success: true, data: { milestones: [] } });
  expect(
    (
      await complete(
        { milestone: "not_allowed" as "first_alert_rule_created" },
        context,
      )
    ).success,
  ).toBe(false);
});

test("Scout fills tabs, creates and selects a destination, and saves the visible form through real services", async () => {
  const id = await createDraft();
  const currentApp = await db.query.app.findFirst({
    where: (app, { eq }) => eq(app.id, context.appId),
  });
  const scoped = { ...context, organizationId: currentApp!.organizationId };
  const notifications = new NotificationDestinationService(
    db,
    createTestLogger() as never,
    new Encryption({ secret: "editor-integration-test" }),
    {} as never,
  );
  let form = createEmptyAlertRuleForm();
  let tab = "condition";
  let choices: Array<{
    id: string;
    name: string;
    kind: string;
    isEnabled: boolean;
  }> = [];
  const target = { editorId: "integration-editor", ruleId: id };
  const editor = createRuleEditorController({
    ...target,
    isActive: () => true,
    getForm: () => form,
    setForm: (next) => {
      form = next;
    },
    getTab: () => tab,
    reveal: async (next) => {
      tab = next;
    },
    getDestinations: () => choices,
    loadMetric: async () => ({ type: "gauge", unit: "%", isMonotonic: false }),
    refreshDestinations: async () => {
      const result = await notifications.listNotificationDestinations(context);
      if (!result.success) throw new Error(result.error);
      choices = result.data.destinations;
    },
    createDestination: async (input) =>
      notifications.createNotificationDestination(
        createNotificationDestinationInputSchema.parse(input),
        scoped,
      ),
    save: async (visible) =>
      service.updateAlertRule({ ...visible, id }, context),
  });
  expect(await editor.execute("get_rule_editor", target)).toMatchObject({
    data: { revision: 0 },
  });
  expect(
    await editor.execute("edit_rule_condition", {
      ...target,
      revision: 0,
      condition: {
        name: "Checkout errors",
        metricName: "$request.error_rate",
        threshold: 7,
        windowMinutes: 10,
      },
    }),
  ).toMatchObject({ data: { revision: 1, tab: "condition" } });
  expect(
    await editor.execute("edit_rule_filters", {
      ...target,
      revision: 1,
      scope: { services: { include: ["checkout"], exclude: [] } },
    }),
  ).toMatchObject({ data: { revision: 2, tab: "scope" } });
  const created = await editor.execute("create_notification_destination", {
    ...target,
    revision: 2,
    destination: {
      kind: "email",
      name: "Checkout team",
      recipients: ["checkout@example.com"],
    },
  });
  expect(created).toMatchObject({
    data: { revision: 3, tab: "notifications" },
  });
  expect(choices.some((choice) => choice.name === "Checkout team")).toBe(true);
  expect(form.destinationIds).toHaveLength(1);
  const beforeSave = await service.getAlertRule(id, context);
  expect(beforeSave.success && beforeSave.data.rule.isDraft).toBe(true);
  expect(
    await editor.execute("save_rule", { ...target, revision: 3 }),
  ).toMatchObject({ data: { saved: true } });
  const saved = await service.getAlertRule(id, context);
  expect(saved).toMatchObject({
    success: true,
    data: {
      rule: {
        isDraft: false,
        metricName: "$request.error_rate",
        threshold: 7,
        windowMinutes: 10,
        scopeServicesInclude: ["checkout"],
        destinationIds: form.destinationIds,
      },
    },
  });
});

test("a streamed Scout turn resumes after browser actions and saves without replaying history", async () => {
  const { MockLanguageModelV4, simulateReadableStream } =
    await import("ai/test");
  const { createStreamChat } =
    await import("$lib/server/services/chat/methods/stream-chat");
  const { chat, chatMessage } = await import("@repo/db/schema");
  const id = await createDraft();
  const currentApp = await db.query.app.findFirst({
    where: (app, { eq }) => eq(app.id, context.appId),
  });
  const scoped = { ...context, organizationId: currentApp!.organizationId };
  const chatId = "live-editor-stream-test";
  await db.insert(chat).values({
    id: chatId,
    appId: context.appId,
    organizationId: scoped.organizationId,
    createdBy: context.userId,
    title: "Build error rule",
  });
  const target = { editorId: "stream-editor", ruleId: id };
  let form = createEmptyAlertRuleForm();
  const editor = createRuleEditorController({
    ...target,
    isActive: () => true,
    getForm: () => form,
    setForm: (next) => {
      form = next;
    },
    getTab: () => "condition",
    reveal: async () => {},
    getDestinations: () => [],
    loadMetric: async () => ({ type: "gauge", unit: "%", isMonotonic: false }),
    refreshDestinations: async () => {},
    createDestination: async () => ({ success: false }),
    save: async (visible) =>
      service.updateAlertRule({ ...visible, id }, context),
  });
  const calls = [
    { toolName: "get_rule_editor", input: target },
    {
      toolName: "edit_rule_condition",
      input: {
        ...target,
        revision: 0,
        condition: {
          name: "Streamed error rule",
          metricName: "$request.error_rate",
          threshold: 8,
        },
      },
    },
    { toolName: "save_rule", input: { ...target, revision: 1 } },
  ];
  let step = 0;
  const model = new MockLanguageModelV4({
    doStream: async () => {
      const call = calls[step++];
      const content = call
        ? [
            {
              type: "tool-call" as const,
              toolCallId: `editor-stream-call-${step}`,
              toolName: call.toolName,
              input: JSON.stringify(call.input),
            },
          ]
        : [
            { type: "text-start" as const, id: "text-1" },
            {
              type: "text-delta" as const,
              id: "text-1",
              delta: "Saved the rule.",
            },
            { type: "text-end" as const, id: "text-1" },
          ];
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start" as const, warnings: [] },
            ...content,
            {
              type: "finish" as const,
              finishReason: {
                unified: call ? ("tool-calls" as const) : ("stop" as const),
                raw: undefined,
              },
              usage: {
                inputTokens: {
                  total: 10,
                  noCache: 10,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: { total: 10, text: 10, reasoning: 0 },
              },
            },
          ],
        }),
      };
    },
  });
  const stream = createStreamChat({
    db,
    logger: createTestLogger() as never,
    model,
    chatUsageService: {
      canStart: async () => ({ success: true }),
      recordUsage: async () => ({ success: true }),
    } as never,
    toolServices: { alertRuleService: service } as never,
    toolApprovalSecret: "stream-test-secret",
    cdnBaseUrl: "https://cdn.example.com/",
  });
  let incoming: {
    id: string;
    role: "user" | "assistant";
    parts: Array<Record<string, unknown>>;
  } = {
    id: "user-stream-editor",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Create and save a rule for an error rate above 8%.",
      },
    ],
  };
  for (let index = 0; index < 4; index++) {
    const response = await stream(
      { id: chatId, ruleEditor: target, message: incoming },
      scoped,
    );
    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(body).not.toContain('"type":"error"');
    expect(body).not.toContain("tool-approval-request");
    const rows = await db
      .select()
      .from(chatMessage)
      .where(eq(chatMessage.chatId, chatId));
    const last = rows.sort((a, b) => a.position - b.position).at(-1)!;
    expect(last.role).toBe("assistant");
    incoming = {
      id: last.id,
      role: "assistant",
      parts: structuredClone(last.parts),
    };
    for (const part of incoming.parts) {
      if (part.state !== "input-available") continue;
      const name = String(
        part.toolName ?? String(part.type).replace(/^tool-/, ""),
      );
      part.output = await editor.execute(name, part.input);
      part.state = "output-available";
    }
  }
  expect(step).toBe(4);
  const saved = await service.getAlertRule(id, context);
  expect(saved).toMatchObject({
    success: true,
    data: {
      rule: { isDraft: false, name: "Streamed error rule", threshold: 8 },
    },
  });
  expect(JSON.stringify(model.doStreamCalls.at(-1)?.prompt)).toContain(
    '"saved":true',
  );
});

test("alert onboarding completes on actual saves and heartbeat creation has no onboarding milestone", async () => {
  const { createCreateHeartbeatMonitor } =
    await import("$lib/server/services/heartbeat/methods/create-heartbeat-monitor");
  const { createCreateHeartbeatMonitors } =
    await import("$lib/server/services/heartbeat/methods/create-heartbeat-monitors");
  const { heartbeatMonitor, onboarding } = await import("@repo/db/schema");
  await db.insert(user).values([
    {
      id: "creation-user",
      name: "Creator",
      email: "creation-user@example.com",
    },
    {
      id: "bulk-creation-user",
      name: "Bulk creator",
      email: "bulk-creation-user@example.com",
    },
  ]);
  const creator = { ...context, userId: "creation-user" };
  const getProgress = createGetOnboardingProgress({
    db,
    logger: createTestLogger() as never,
  });
  const draft = await service.createAlertRuleDraft(creator);
  expect(draft.success).toBe(true);
  if (!draft.success) throw new Error(draft.error);
  expect(await getProgress(creator)).toMatchObject({
    data: { milestones: [] },
  });
  const condition = {
    ...createEmptyAlertRuleForm(),
    name: "First rule",
    metricName: "$request.error_rate",
    metricType: "gauge",
    metricAggregation: "avg" as const,
    metricUnit: "%",
  };
  expect(
    (
      await service.updateAlertRule(
        { ...condition, id: draft.data.id, threshold: 102102 },
        creator,
      )
    ).success,
  ).toBe(false);
  expect(await getProgress(creator)).toMatchObject({
    data: { milestones: [] },
  });
  expect(
    (
      await service.updateAlertRule(
        { ...condition, id: draft.data.id },
        creator,
      )
    ).success,
  ).toBe(true);
  expect(await getProgress(creator)).toMatchObject({
    data: { milestones: ["first_alert_rule_created"] },
  });

  const dependencies = {
    db,
    logger: createTestLogger() as never,
    loadDestinations: async () => ({
      success: true as const,
      data: { destinations: [] },
    }),
    config: { ingestBaseUrl: "https://ingest.example.com" },
  };
  const createOne = createCreateHeartbeatMonitor(dependencies);
  const created = await createOne(
    { name: "First heartbeat", expectedEverySeconds: 60, graceSeconds: 10 },
    creator,
  );
  expect(created.success).toBe(true);
  if (!created.success) throw new Error(created.error);
  await db
    .delete(heartbeatMonitor)
    .where(eq(heartbeatMonitor.id, created.data.id));
  const completed = await getProgress(creator);
  expect(completed.success && completed.data.milestones.sort()).toEqual([
    "first_alert_rule_created",
  ]);
  const createMany = createCreateHeartbeatMonitors(dependencies);
  const bulk = { ...context, userId: "bulk-creation-user" };
  expect(
    (
      await createMany(
        {
          monitors: [
            {
              name: "Nightly sync",
              expectedEverySeconds: 300,
              graceSeconds: 30,
            },
            {
              name: "Daily report",
              expectedEverySeconds: 3600,
              graceSeconds: 60,
            },
          ],
        },
        bulk,
      )
    ).success,
  ).toBe(true);
  expect(await getProgress(bulk)).toMatchObject({
    data: { milestones: [] },
  });
  expect((await service.createAlertRule(condition, bulk)).success).toBe(true);
  expect(
    (
      await service.createAlertRule(
        { ...condition, name: "Another rule" },
        bulk,
      )
    ).success,
  ).toBe(true);
  const milestones = await db
    .select()
    .from(onboarding)
    .where(eq(onboarding.userId, bulk.userId));
  expect(milestones).toHaveLength(1);
});
