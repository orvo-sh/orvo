import { recordError } from "$lib/instrumentation";
import type { ChatService } from "$lib/server/services/chat";
import type { DB } from "@repo/db";
import {
  app,
  chat,
  chatMessage,
  member,
  notificationDestination,
  slackEvent,
  slackScoutThread,
  slackUserLink,
} from "@repo/db/schema";
import type { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { genId } from "@repo/utils";
import { and, asc, desc, eq, gt } from "drizzle-orm";

import { slackEventCallbackSchema } from "../schema";
import {
  appendSlackStream,
  postSlackMessage,
  setSlackAgentStatus,
  setSlackAssistantStatus,
  startSlackStream,
  stopSlackStream,
  toSlackMarkdown,
} from "../slack-client";

const consumeUiResponse = async (
  response: Response,
  onText: (delta: string) => Promise<void>,
) => {
  if (!response.ok || !response.body) {
    throw new Error((await response.text()) || "Scout request failed.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  while (true) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value, { stream: !done });
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data || data === "[DONE]") continue;
      const chunk = JSON.parse(data) as { type?: string; delta?: string };
      if (chunk.type === "text-delta" && chunk.delta) {
        await onText(chunk.delta);
      }
    }
    if (done) break;
  }
};

const createProcessScoutRun = ({
  db,
  encryption,
  chatService,
  origin,
  createLinkUrl,
  logger,
}: {
  db: DB;
  encryption: Encryption;
  chatService: ChatService;
  origin: string;
  createLinkUrl: (input: {
    teamId: string;
    slackUserId: string;
    organizationId: string;
    appId: string;
    eventId: string;
  }) => Promise<
    { success: true; data: { url: string } } | { success: false; error: string }
  >;
  logger: Logger;
}) => {
  const updateAgentStatus = async (
    token: string,
    input: {
      channelId: string;
      threadTs: string;
      status: "processing" | "active" | "suspended" | "closed";
      title?: string;
    },
  ) => {
    try {
      await setSlackAgentStatus(token, input);
      return;
    } catch {
      try {
        await setSlackAssistantStatus(token, {
          channelId: input.channelId,
          threadTs: input.threadTs,
          status:
            input.status === "processing"
              ? "is working on your request..."
              : "",
        });
        return;
      } catch (error) {
        logger.warn("processScoutRun: Slack agent status unavailable", {
          status: input.status,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  const streamToSlack = async (input: {
    response: Response;
    token: string;
    teamId: string;
    slackUserId: string;
    channelId: string;
    threadTs: string;
    chatId: string;
    appId: string;
  }) => {
    let stream: { channel: string; ts: string } | null = null;
    let buffer = "";
    let fullText = "";

    const flush = async (force = false) => {
      if (!buffer || (!force && buffer.length < 320)) return;
      const text = toSlackMarkdown(
        buffer,
        new URL(
          `/a/${encodeURIComponent(input.appId)}/traces/`,
          origin,
        ).toString(),
      );
      buffer = "";
      if (!stream) {
        stream = await startSlackStream(input.token, {
          channel: input.channelId,
          threadTs: input.threadTs,
          teamId: input.teamId,
          userId: input.slackUserId,
          markdownText: text,
        });
      } else {
        await appendSlackStream(input.token, {
          channel: input.channelId,
          ts: stream.ts,
          markdownText: text,
        });
      }
    };

    await consumeUiResponse(input.response, async (delta) => {
      fullText += delta;
      buffer += delta;
      await flush();
    });
    await flush(true);
    const activeStream = stream as { channel: string; ts: string } | null;
    if (activeStream) {
      await stopSlackStream(input.token, {
        channel: input.channelId,
        ts: activeStream.ts,
      });
    }

    const assistantMessage = await db.query.chatMessage.findFirst({
      where: and(
        eq(chatMessage.chatId, input.chatId),
        eq(chatMessage.role, "assistant"),
      ),
      orderBy: desc(chatMessage.position),
    });
    const approval = assistantMessage?.parts.find(
      (part) =>
        "toolCallId" in part &&
        part.state === "approval-requested" &&
        part.approval &&
        typeof part.toolCallId === "string",
    );

    if (!stream && !approval) {
      await postSlackMessage(input.token, {
        channel: input.channelId,
        threadTs: input.threadTs,
        text: fullText.trim() || "Scout couldn't complete that response.",
      });
    }

    if (approval && assistantMessage && "toolCallId" in approval) {
      const approvalDetails = approval.approval as {
        id: string;
        signature?: string;
      };
      const toolName =
        "toolName" in approval && typeof approval.toolName === "string"
          ? approval.toolName.replaceAll("_", " ")
          : "requested action";
      const value = JSON.stringify({
        chatId: input.chatId,
        messageId: assistantMessage.id,
        toolCallId: approval.toolCallId,
        approvalId: approvalDetails.id,
        signature: approvalDetails.signature,
        appId: input.appId,
        channelId: input.channelId,
        threadTs: input.threadTs,
      });
      await postSlackMessage(input.token, {
        channel: input.channelId,
        threadTs: input.threadTs,
        text: `Scout needs approval to ${toolName}.`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Approval required*\nScout wants to ${toolName}.`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                action_id: "scout_approve",
                style: "primary",
                text: { type: "plain_text", text: "Approve" },
                value,
              },
              {
                type: "button",
                action_id: "scout_reject",
                text: { type: "plain_text", text: "Cancel" },
                value,
              },
            ],
          },
        ],
      });
    }
  };

  return async (job: {
    kind: "message" | "approval";
    eventId?: string;
    teamId?: string;
    slackUserId?: string;
    approved?: boolean;
    action?: {
      chatId: string;
      messageId: string;
      toolCallId: string;
      approvalId: string;
      signature?: string;
      appId: string;
      channelId: string;
      threadTs: string;
    };
  }) => {
    if (job.kind === "approval") {
      if (!job.teamId || !job.slackUserId || !job.action) {
        throw new Error("Invalid Slack Scout approval job.");
      }
      const action = job.action;
      const [link, currentChat, destination, storedMessage] = await Promise.all(
        [
          db.query.slackUserLink.findFirst({
            where: and(
              eq(slackUserLink.teamId, job.teamId),
              eq(slackUserLink.slackUserId, job.slackUserId),
            ),
          }),
          db.query.chat.findFirst({
            where: and(
              eq(chat.id, action.chatId),
              eq(chat.appId, action.appId),
            ),
          }),
          db.query.notificationDestination.findFirst({
            where: and(
              eq(notificationDestination.appId, action.appId),
              eq(notificationDestination.kind, "slack"),
              eq(notificationDestination.slackTeamId, job.teamId),
            ),
          }),
          db.query.chatMessage.findFirst({
            where: and(
              eq(chatMessage.chatId, action.chatId),
              eq(chatMessage.id, action.messageId),
            ),
          }),
        ],
      );
      if (!link || !currentChat || !destination || !storedMessage) {
        throw new Error("Slack Scout approval context was not found.");
      }
      const currentMember = await db.query.member.findFirst({
        where: and(
          eq(member.organizationId, currentChat.organizationId),
          eq(member.userId, link.userId),
        ),
      });
      if (!currentMember || !destination.slackBotTokenEncrypted) {
        throw new Error("Slack user is no longer authorized.");
      }
      const token = encryption.decrypt(destination.slackBotTokenEncrypted);
      await updateAgentStatus(token, {
        channelId: action.channelId,
        threadTs: action.threadTs,
        status: "processing",
      });
      try {
        const response = await chatService.streamChat(
          {
            id: currentChat.id,
            message: {
              id: storedMessage.id,
              role: "assistant",
              parts: storedMessage.parts.map((part) =>
                "toolCallId" in part && part.toolCallId === action.toolCallId
                  ? {
                      ...part,
                      state: "approval-responded",
                      approval: {
                        id: action.approvalId,
                        signature: action.signature,
                        approved: job.approved === true,
                      },
                    }
                  : part,
              ),
            },
          },
          {
            organizationId: currentChat.organizationId,
            appId: currentChat.appId,
            userId: link.userId,
            surface: "slack",
          },
        );
        await streamToSlack({
          response,
          token,
          teamId: job.teamId,
          slackUserId: job.slackUserId,
          channelId: action.channelId,
          threadTs: action.threadTs,
          chatId: currentChat.id,
          appId: currentChat.appId,
        });
      } finally {
        await updateAgentStatus(token, {
          channelId: action.channelId,
          threadTs: action.threadTs,
          status: "active",
        });
      }
      return;
    }

    if (!job.eventId) throw new Error("Slack event ID is missing.");
    const storedEvent = await db.query.slackEvent.findFirst({
      where: eq(slackEvent.id, job.eventId),
    });
    if (!storedEvent) throw new Error("Slack event was not found.");
    const parsed = slackEventCallbackSchema.safeParse(storedEvent.payload);
    if (!parsed.success) throw new Error("Stored Slack event is invalid.");
    const event = parsed.data.event;
    const destinations = await db
      .select({
        destination: notificationDestination,
        organizationId: app.organizationId,
      })
      .from(notificationDestination)
      .innerJoin(app, eq(app.id, notificationDestination.appId))
      .where(
        and(
          eq(notificationDestination.kind, "slack"),
          eq(notificationDestination.isEnabled, true),
          eq(notificationDestination.slackTeamId, parsed.data.team_id),
        ),
      );
    const available = destinations.filter(
      ({ destination }) => destination.slackBotTokenEncrypted,
    );
    if (!available.length) {
      await db
        .update(slackEvent)
        .set({ processedAt: new Date() })
        .where(eq(slackEvent.id, storedEvent.id));
      return;
    }
    const primary = available[0]!;
    const token = encryption.decrypt(
      primary.destination.slackBotTokenEncrypted!,
    );
    const threadTs = event.thread_ts ?? event.ts;

    if (available.length > 1) {
      await postSlackMessage(token, {
        channel: event.channel,
        threadTs,
        text: "This channel is connected to more than one Orvo app. Connect each app to a different Slack channel before asking Scout here.",
      });
      await db
        .update(slackEvent)
        .set({ processedAt: new Date() })
        .where(eq(slackEvent.id, storedEvent.id));
      return;
    }

    const link = await db.query.slackUserLink.findFirst({
      where: and(
        eq(slackUserLink.teamId, parsed.data.team_id),
        eq(slackUserLink.slackUserId, event.user),
      ),
    });
    const currentMember = link
      ? await db.query.member.findFirst({
          where: and(
            eq(member.organizationId, primary.organizationId),
            eq(member.userId, link.userId),
          ),
        })
      : null;
    if (!link || !currentMember) {
      const linkResult = await createLinkUrl({
        teamId: parsed.data.team_id,
        slackUserId: event.user,
        organizationId: primary.organizationId,
        appId: primary.destination.appId,
        eventId: storedEvent.id,
      });
      if (!linkResult.success) throw new Error(linkResult.error);
      const linkMessage = {
        text: `Connect your Orvo account before using Scout: ${linkResult.data.url}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*Connect your Orvo account*\nSign in once so Scout can use your Orvo permissions in Slack.",
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                style: "primary",
                text: { type: "plain_text", text: "Connect account" },
                url: linkResult.data.url,
                action_id: "scout_link_account",
              },
            ],
          },
        ],
      };
      await postSlackMessage(token, {
        channel: event.channel.startsWith("D") ? event.channel : event.user,
        ...linkMessage,
      });
      if (!event.channel.startsWith("D")) {
        await postSlackMessage(token, {
          channel: event.channel,
          threadTs,
          text: `<@${event.user}> I sent you a private message to connect your Orvo account.`,
        });
      }
      await db
        .update(slackEvent)
        .set({ processedAt: new Date() })
        .where(eq(slackEvent.id, storedEvent.id));
      return;
    }

    let thread = await db.query.slackScoutThread.findFirst({
      where: and(
        eq(slackScoutThread.teamId, parsed.data.team_id),
        eq(slackScoutThread.channelId, event.channel),
        eq(slackScoutThread.threadTs, threadTs),
      ),
    });
    if (!thread) {
      const chatId = genId("chat");
      await db.transaction(async (tx) => {
        await tx.insert(chat).values({
          id: chatId,
          organizationId: primary.organizationId,
          appId: primary.destination.appId,
          title: "Slack investigation",
          createdBy: link.userId,
          updatedBy: link.userId,
        });
        await tx.insert(slackScoutThread).values({
          id: genId("slst"),
          teamId: parsed.data.team_id,
          channelId: event.channel,
          threadTs,
          chatId,
          appId: primary.destination.appId,
        });
      });
      thread = await db.query.slackScoutThread.findFirst({
        where: eq(slackScoutThread.chatId, chatId),
      });
    }
    if (!thread) throw new Error("Failed to create Slack Scout thread.");

    const prompt =
      event.text.replace(/<@[^>]+>/g, "").trim() ||
      "Give me a quick overview of this app.";
    const messageId = `slack_${storedEvent.id}`;
    const previousUserMessage = await db.query.chatMessage.findFirst({
      where: and(
        eq(chatMessage.chatId, thread.chatId),
        eq(chatMessage.id, messageId),
      ),
    });
    if (previousUserMessage) {
      const previousAssistantMessage = await db.query.chatMessage.findFirst({
        where: and(
          eq(chatMessage.chatId, thread.chatId),
          eq(chatMessage.role, "assistant"),
          gt(chatMessage.position, previousUserMessage.position),
        ),
        orderBy: asc(chatMessage.position),
      });
      if (previousAssistantMessage) {
        const text = previousAssistantMessage.parts
          .filter(
            (part) => part.type === "text" && typeof part.text === "string",
          )
          .map((part) => String(part.text))
          .join("");
        await streamToSlack({
          response: new Response(
            text
              ? `data: ${JSON.stringify({ type: "text-delta", delta: text })}\n\ndata: [DONE]\n\n`
              : "data: [DONE]\n\n",
            { status: 200 },
          ),
          token,
          teamId: parsed.data.team_id,
          slackUserId: event.user,
          channelId: event.channel,
          threadTs,
          chatId: thread.chatId,
          appId: primary.destination.appId,
        });
        await db
          .update(slackEvent)
          .set({ processedAt: new Date() })
          .where(eq(slackEvent.id, storedEvent.id));
        return;
      }
      await db
        .delete(chatMessage)
        .where(
          and(
            eq(chatMessage.chatId, thread.chatId),
            eq(chatMessage.id, messageId),
          ),
        );
    }
    await updateAgentStatus(token, {
      channelId: event.channel,
      threadTs,
      status: "processing",
      title: "Scout investigation",
    });
    try {
      const response = await chatService.streamChat(
        {
          id: thread.chatId,
          message: {
            id: messageId,
            role: "user",
            parts: [{ type: "text", text: prompt }],
          },
        },
        {
          organizationId: primary.organizationId,
          appId: primary.destination.appId,
          userId: link.userId,
          surface: "slack",
        },
      );
      await streamToSlack({
        response,
        token,
        teamId: parsed.data.team_id,
        slackUserId: event.user,
        channelId: event.channel,
        threadTs,
        chatId: thread.chatId,
        appId: primary.destination.appId,
      });
    } finally {
      await updateAgentStatus(token, {
        channelId: event.channel,
        threadTs,
        status: "active",
      });
    }
    await db
      .update(slackEvent)
      .set({ processedAt: new Date() })
      .where(eq(slackEvent.id, storedEvent.id));
  };
};

const wrapProcessScoutRun =
  (method: ReturnType<typeof createProcessScoutRun>, logger: Logger) =>
  async (job: Parameters<typeof method>[0]) => {
    try {
      await method(job);
    } catch (error) {
      recordError(error);
      logger.error(
        "processScoutRun: failed to process Slack Scout run",
        error as Error,
      );
      throw error;
    }
  };

export { createProcessScoutRun, wrapProcessScoutRun };
