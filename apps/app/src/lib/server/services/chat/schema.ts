import { z } from "zod";

const chatContextKindSchema = z.enum([
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
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
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
  messages: z.array(
    z.object({
      id: z.string().trim().min(1),
      role: z.enum(["system", "user", "assistant"]),
      parts: z.array(z.record(z.string(), z.unknown())),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
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
