import { z } from "zod";

const slackActionValueSchema = z.object({
  destinationId: z.string().trim().min(1),
  incidentId: z.string().trim().min(1),
});

const slackInteractionPayloadSchema = z.object({
  type: z.literal("block_actions"),
  team: z.object({ id: z.string().trim().min(1) }),
  user: z.object({
    id: z.string().trim().min(1),
    username: z.string().optional(),
    name: z.string().optional(),
  }),
  response_url: z.url().optional(),
  channel: z.object({ id: z.string().trim().min(1) }).optional(),
  message: z.object({ ts: z.string().trim().min(1) }).optional(),
  actions: z
    .array(
      z.object({
        action_id: z.string(),
        value: z.string().optional(),
      }),
    )
    .min(1),
});

const slackOauthResponseSchema = z.object({
  ok: z.literal(true),
  access_token: z.string().trim().min(1),
  scope: z.string().default(""),
  bot_user_id: z.string().trim().min(1),
  team: z.object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
  }),
});

const updateSlackChannelInputSchema = z.object({
  channelId: z.string().trim().min(1),
});

const slackMessageEventSchema = z.object({
  type: z.literal("message"),
  user: z.string().trim().min(1),
  text: z.string().default(""),
  channel: z.string().trim().min(1),
  channel_type: z.string().optional(),
  ts: z.string().trim().min(1),
  thread_ts: z.string().trim().min(1).optional(),
  bot_id: z.string().optional(),
  subtype: z.string().optional(),
});

const slackEventCallbackSchema = z.object({
  type: z.literal("event_callback"),
  event_id: z.string().trim().min(1),
  team_id: z.string().trim().min(1),
  event: z.union([
    slackMessageEventSchema.extend({ type: z.literal("app_mention") }),
    slackMessageEventSchema,
  ]),
});

const slackScoutActionValueSchema = z.object({
  chatId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  toolCallId: z.string().trim().min(1),
  approvalId: z.string().trim().min(1),
  signature: z.string().optional(),
  appId: z.string().trim().min(1),
  channelId: z.string().trim().min(1),
  threadTs: z.string().trim().min(1),
});

export {
  slackActionValueSchema,
  slackInteractionPayloadSchema,
  slackOauthResponseSchema,
  slackEventCallbackSchema,
  slackScoutActionValueSchema,
  updateSlackChannelInputSchema,
};
