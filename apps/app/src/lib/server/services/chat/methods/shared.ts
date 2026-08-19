import type { DB } from "@repo/db";
import { chat } from "@repo/db/schema";
import { and, eq } from "drizzle-orm";

const findOwnedChat = async (
  db: DB,
  id: string,
  context: { organizationId: string; appId: string; userId: string },
) =>
  db.query.chat.findFirst({
    where: and(
      eq(chat.id, id),
      eq(chat.organizationId, context.organizationId),
      eq(chat.appId, context.appId),
      eq(chat.createdBy, context.userId),
    ),
  });

const deriveChatTitle = (
  messages: Array<{ role: string; parts: unknown[] }>,
) => {
  const text = messages
    .find((message) => message.role === "user")
    ?.parts.find(
      (part): part is { type: "text"; text: string } =>
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string",
    )
    ?.text.trim();

  if (!text) {
    const filename = messages
      .find((message) => message.role === "user")
      ?.parts.find(
        (part): part is { type: "file"; filename: string } =>
          typeof part === "object" &&
          part !== null &&
          "type" in part &&
          part.type === "file" &&
          "filename" in part &&
          typeof part.filename === "string",
      )?.filename;
    return filename
      ? `Attachment: ${filename}`.slice(0, 72).trimEnd()
      : "New chat";
  }

  const singleLine = text.replace(/\s+/g, " ");
  return singleLine.length > 72
    ? `${singleLine.slice(0, 71).trimEnd()}…`
    : singleLine;
};

export { deriveChatTitle, findOwnedChat };
