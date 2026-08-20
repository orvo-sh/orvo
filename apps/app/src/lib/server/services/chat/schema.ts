import { z } from "zod";

const chatContextKindSchema = z.enum([
  "overview",
  "trace",
  "log",
  "metric",
  "incident",
  "heartbeat",
]);

const chatContextInputSchema = z.object({
  kind: chatContextKindSchema,
  resourceId: z.string().trim().min(1).max(255),
  label: z.string().trim().min(1).max(255),
  metadata: z
    .record(
      z.string().trim().min(1).max(64),
      z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
    )
    .refine((value) => Object.keys(value).length <= 12, {
      message: "Context metadata is too large.",
    })
    .optional()
    .default({}),
});

const createChatInputSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  context: chatContextInputSchema.optional(),
});

const getChatInputSchema = z.object({
  id: z.string().trim().min(1),
});

const deleteChatInputSchema = getChatInputSchema;

const listChatsInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
});

const streamChatInputSchema = z.object({
  id: z.string().trim().min(1),
  pageContext: chatContextInputSchema.optional(),
  message: z
    .object({
      id: z.string().trim().min(1),
      role: z.enum(["user", "assistant"]),
      parts: z.array(z.record(z.string(), z.unknown())).max(100),
    })
    .refine((message) => JSON.stringify(message).length <= 100_000, {
      message: "Chat message is too large.",
    }),
});

export {
  chatContextInputSchema,
  chatContextKindSchema,
  createChatInputSchema,
  deleteChatInputSchema,
  getChatInputSchema,
  listChatsInputSchema,
  streamChatInputSchema,
};
