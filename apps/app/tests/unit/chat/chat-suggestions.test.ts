import { expect, test, vi } from "vitest";
import { z } from "zod";
import type { UIMessage, UIMessageChunk } from "ai";
import { readUIMessageStream } from "ai";
import {
  getFollowUpSuggestions,
  nextActionsSchema,
} from "$lib/chat/suggestions";
import { getHeartbeatSuggestions } from "$lib/heartbeats/heartbeat-suggestions";
import { createNextActionsTool } from "$lib/server/services/chat/tools/next-actions";
import { createChatTools } from "$lib/server/services/chat/tools";
import { compactToolOutput } from "$lib/server/services/chat/tools/compact";
import {
  createClientChatStream,
  sanitizeChatMessagesForClient,
} from "$lib/server/services/chat/tools/presentation";

const context = {
  kind: "heartbeat" as const,
  resourceId: "heartbeat-1",
  label: "Daily backup",
};
const suggestions = [
  {
    label: "Review this job’s grace period.",
    prompt:
      "Review this heartbeat's grace period against recent check-ins before changing it.",
  },
];
const message = (): UIMessage => ({
  id: "assistant-1",
  role: "assistant",
  metadata: { finishReason: "stop" },
  parts: [
    {
      type: "dynamic-tool",
      toolName: "suggest_next_actions",
      toolCallId: "call-1",
      state: "output-available",
      input: { suggestions },
      output: { context, suggestions },
    },
  ],
});

test("heartbeat starters match setup, health, pause, and notification state", () => {
  const monitor = {
    isPaused: false,
    status: "pending",
    lastCheckInAt: null as Date | null,
    destinationIds: [] as string[],
  };
  expect(getHeartbeatSuggestions(monitor)[0].label).toContain("first check-in");
  expect(getHeartbeatSuggestions(monitor)[2].label).toContain(
    "add notifications",
  );
  monitor.lastCheckInAt = new Date();
  monitor.status = "healthy";
  monitor.destinationIds = ["destination-1"];
  expect(getHeartbeatSuggestions(monitor)[0].label).toContain("reliably");
  expect(getHeartbeatSuggestions(monitor)[2].label).toContain(
    "who gets notified",
  );
  monitor.status = "missed";
  expect(getHeartbeatSuggestions(monitor)[0].label).toContain("missed");
  monitor.status = "grace";
  expect(getHeartbeatSuggestions(monitor)[0].label).toContain("running late");
  monitor.isPaused = true;
  expect(getHeartbeatSuggestions(monitor)[0].label).toContain("resume");
});

test("follow-ups survive reload while internal metadata remains private", () => {
  const stored = message();
  stored.metadata = {
    finishReason: "stop",
    internal: "private-provider-payload",
  };
  const loaded = sanitizeChatMessagesForClient([stored]);
  expect(getFollowUpSuggestions(loaded, context)).toEqual(suggestions);
  expect(JSON.stringify(loaded)).not.toContain("private-provider-payload");
  expect(
    getFollowUpSuggestions(loaded, {
      ...context,
      resourceId: "other-heartbeat",
    }),
  ).toEqual([]);
  expect(
    getFollowUpSuggestions(
      [
        ...loaded,
        { id: "next", role: "user", parts: [{ type: "text", text: "Thanks" }] },
      ],
      context,
    ),
  ).toEqual([]);
});

test("incomplete, interrupted and approval-pending turns do not offer follow-ups", () => {
  const incomplete = message();
  incomplete.metadata = undefined;
  expect(getFollowUpSuggestions([incomplete], context)).toEqual([]);
  incomplete.metadata = { finishReason: "length" };
  expect(getFollowUpSuggestions([incomplete], context)).toEqual([]);
  incomplete.metadata = { finishReason: "stop" };
  incomplete.parts.push({
    type: "dynamic-tool",
    toolName: "update_heartbeat_monitor",
    toolCallId: "approval",
    state: "approval-requested",
    input: {},
    approval: { id: "approval-1" },
  });
  expect(getFollowUpSuggestions([incomplete], context)).toEqual([]);
  expect(
    nextActionsSchema.safeParse({ suggestions: Array(4).fill(suggestions[0]) })
      .success,
  ).toBe(false);
});

test("live suggestions arrive as chips through the real SDK stream protocol", async () => {
  const chunks: UIMessageChunk[] = [
    { type: "start", messageId: "assistant-1" },
    { type: "start-step" },
    {
      type: "tool-input-available",
      toolName: "suggest_next_actions",
      toolCallId: "call-1",
      input: { suggestions },
    },
    {
      type: "tool-output-available",
      toolCallId: "call-1",
      output: { context, suggestions, internal: "private" },
    },
    { type: "finish-step" },
    {
      type: "finish",
      finishReason: "stop",
      messageMetadata: { finishReason: "stop" },
    },
  ];
  const stream = createClientChatStream(
    new ReadableStream<UIMessageChunk>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    }),
  );
  let completed: UIMessage | undefined;
  for await (const value of readUIMessageStream({ stream })) completed = value;
  expect(getFollowUpSuggestions([completed!], context)).toEqual(suggestions);
  expect(JSON.stringify(completed)).not.toContain("private");
});

test("next-action tool binds suggestions to the server's page context", async () => {
  const nextActions = createNextActionsTool(context);
  const output = await nextActions.execute!(
    { suggestions },
    { toolCallId: "call-1", messages: [], context: {} },
  );
  expect(output).toEqual({ context, suggestions });
});

test("Scout can read history and reuse enabled app destinations without exposing credentials", async () => {
  const getHeartbeatCheckInHistory = vi.fn(async () => ({
    success: true,
    data: {
      history: {
        buckets: [
          { count: 3, status: "healthy", startAt: "2026-11-19T12:00:00.000Z" },
        ],
      },
    },
  }));
  const listNotificationDestinations = vi.fn(async () => ({
    success: true,
    data: {
      destinations: [
        {
          id: "dest-1",
          name: "Ops",
          kind: "webhook",
          isEnabled: true,
          webhookUrl: "private-url",
          headers: [{ value: "private-key" }],
        },
      ],
    },
  }));
  const tools = createChatTools(
    {
      heartbeatService: { getHeartbeatCheckInHistory },
      notificationDestinationService: { listNotificationDestinations },
    } as never,
    { appId: "app-1", organizationId: "org-1", userId: "user-1" },
  );
  const options = { toolCallId: "call-1", messages: [], context: {} };
  const history = await tools.get_heartbeat_check_in_history.execute!(
    { id: "heartbeat-1", intent: "Review check-ins" },
    options,
  );
  expect(JSON.stringify(history)).toContain('"count":3');
  expect(getHeartbeatCheckInHistory).toHaveBeenCalledWith(
    "heartbeat-1",
    expect.objectContaining({ appId: "app-1" }),
  );
  const destinations = await tools.list_notification_destinations.execute!(
    { intent: "Find existing destinations" },
    options,
  );
  expect(JSON.stringify(destinations)).toContain("dest-1");
  expect(JSON.stringify(destinations)).not.toContain("private");
  expect(
    JSON.stringify(
      compactToolOutput("get_heartbeat_check_in_history", history),
    ),
  ).toContain('"status":"healthy"');
});

test("renaming a heartbeat preserves its interval, grace, and notifications", async () => {
  const updateHeartbeatMonitor = vi.fn(async () => ({
    success: true,
    data: undefined,
  }));
  const getHeartbeatMonitor = vi.fn(async () => ({
    success: true,
    data: {
      monitor: {
        name: "Old backup",
        expectedEverySeconds: 300,
        graceSeconds: 60,
        destinationIds: ["ops-email"],
      },
    },
  }));
  const tools = createChatTools(
    {
      heartbeatService: { getHeartbeatMonitor, updateHeartbeatMonitor },
    } as never,
    { appId: "app-1", organizationId: "org-1", userId: "user-1" },
  );
  const input = (tools.update_heartbeat_monitor.inputSchema as z.ZodType).parse(
    { id: "heartbeat-1", intent: "Rename the backup", name: "Nightly backup" },
  );
  expect(input).not.toHaveProperty("destinationIds");
  const options = { toolCallId: "update-1", messages: [], context: {} };
  await tools.update_heartbeat_monitor.execute!(
    input as { id: string; intent: string; name: string },
    options,
  );
  expect(updateHeartbeatMonitor).toHaveBeenLastCalledWith(
    {
      id: "heartbeat-1",
      name: "Nightly backup",
      expectedEverySeconds: 300,
      graceSeconds: 60,
      destinationIds: ["ops-email"],
    },
    expect.objectContaining({ appId: "app-1", userId: "user-1" }),
  );
  await tools.update_heartbeat_monitor.execute!(
    {
      id: "heartbeat-1",
      intent: "Add the Ops webhook",
      destinationIds: ["ops-email", "ops-webhook"],
    },
    options,
  );
  expect(updateHeartbeatMonitor).toHaveBeenLastCalledWith(
    {
      id: "heartbeat-1",
      name: "Old backup",
      expectedEverySeconds: 300,
      graceSeconds: 60,
      destinationIds: ["ops-email", "ops-webhook"],
    },
    expect.objectContaining({ appId: "app-1" }),
  );
});
