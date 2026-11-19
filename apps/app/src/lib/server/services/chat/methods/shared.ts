import {
  isRuleEditorTool,
  ruleEditorDescriptorSchema,
} from "$lib/alerts/editor-schema";
import { isDashboardEditorTool, dashboardEditorDescriptorSchema } from "$lib/dashboards/editor-schema";
import { z } from "zod";
import type { DB } from "@repo/db";
import { chat } from "@repo/db/schema";
import { and, eq } from "drizzle-orm";
import type { UIMessage } from "ai";

const findOwnedChat = async (
  db: DB,
  id: string,
  context: { organizationId: string; appId: string; userId: string },
  allowShared = false,
) =>
  db.query.chat.findFirst({
    where: and(
      eq(chat.id, id),
      eq(chat.organizationId, context.organizationId),
      eq(chat.appId, context.appId),
      ...(allowShared ? [] : [eq(chat.createdBy, context.userId)]),
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

// Only acknowledge pending browser tools issued by the server. Never accept rewritten
// tool inputs, arbitrary evidence, or results for server-executed tools.
const mergeChatEditorOutputs = (stored: UIMessage, incoming: UIMessage) => {
  if (
    stored.id !== incoming.id ||
    stored.role !== "assistant" ||
    incoming.role !== "assistant"
  )
    return null;
  let changed = false;
  const outputSchema = z
    .object({
      error: z.string().max(2000).optional(),
      data: z.record(z.string(), z.unknown()).optional(),
    })
    .refine((value) => value.error !== undefined || value.data !== undefined);
  const parts = stored.parts.map((part) => {
    if (!("toolCallId" in part) || part.state !== "input-available")
      return part;
    const name =
      part.type === "dynamic-tool"
        ? part.toolName
        : part.type.replace(/^tool-/, "");
    if (!isRuleEditorTool(name) && !isDashboardEditorTool(name)) return part;
    const target = (isDashboardEditorTool(name) ? dashboardEditorDescriptorSchema : ruleEditorDescriptorSchema).safeParse(part.input);
    if (!target.success) return part;
    const response = incoming.parts.find(
      (item) =>
        "toolCallId" in item &&
        item.toolCallId === part.toolCallId &&
        item.state === "output-available",
    );
    if (!response || !("output" in response)) return part;
    const output = outputSchema.safeParse(response.output);
    if (!output.success || JSON.stringify(output.data).length > 40000)
      return part;
    if (
      output.data.data &&
      (("dashboardId" in target.data ? output.data.data.dashboardId !== target.data.dashboardId : output.data.data.ruleId !== target.data.ruleId) ||
        output.data.data.editorId !== target.data.editorId)
    )
      return part;
    changed = true;
    return { ...part, state: "output-available", output: output.data };
  });
  return changed ? ({ ...stored, parts } as UIMessage) : null;
};

export { findOwnedChat, mergeChatToolApproval, mergeChatEditorOutputs };
