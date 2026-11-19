import { nextActionsSchema } from "$lib/chat/suggestions";
import { tool } from "ai";

const createNextActionsTool = (context: { kind: string; resourceId: string }) =>
  tool({
    description:
      "Set up to three optional next-action chips for the user after your final answer. Base them on the conversation, successful tool results, and what is still useful for this heartbeat or alert rule. Use clear user-facing labels and self-contained prompts. Do not repeat completed, declined, or already suggested actions. Use an empty list when there is no useful next step. This only offers suggestions; it never executes the actions.",
    inputSchema: nextActionsSchema,
    execute: async ({ suggestions }) => ({ context, suggestions }),
  });

export { createNextActionsTool };
