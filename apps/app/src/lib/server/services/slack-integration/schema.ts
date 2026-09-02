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
  team: z.object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
  }),
  incoming_webhook: z.object({
    channel: z.string().trim().min(1),
    channel_id: z.string().trim().min(1),
    url: z.url(),
  }),
});

export {
  slackActionValueSchema,
  slackInteractionPayloadSchema,
  slackOauthResponseSchema,
};
