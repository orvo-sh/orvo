import type { DB } from "@repo/db";
import { chat } from "@repo/db/schema";
import { and, eq } from "drizzle-orm";
import type { UIMessage } from "ai";

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

const mergeChatToolApproval = (stored: UIMessage, incoming: UIMessage) => {
  if (
    stored.id !== incoming.id ||
    stored.role !== "assistant" ||
    incoming.role !== "assistant"
  ) {
    return null;
  }

  let changed = false;
  const parts = stored.parts.map((part) => {
    if (
      !("toolCallId" in part) ||
      part.state !== "approval-requested" ||
      !part.approval
    ) {
      return part;
    }
    const response = incoming.parts.find(
      (candidate) =>
        "toolCallId" in candidate &&
        candidate.toolCallId === part.toolCallId &&
        candidate.state === "approval-responded" &&
        candidate.approval.id === part.approval.id &&
        candidate.approval.signature === part.approval.signature,
    );
    const approval =
      response && "approval" in response ? response.approval : null;
    if (!approval || typeof approval.approved !== "boolean") return part;

    changed = true;
    return {
      ...part,
      state: "approval-responded" as const,
      approval: {
        ...part.approval,
        approved: approval.approved,
        ...(approval.reason ? { reason: approval.reason.slice(0, 500) } : {}),
      },
    };
  });

  return changed ? ({ ...stored, parts } as UIMessage) : null;
};

export { findOwnedChat, mergeChatToolApproval };
