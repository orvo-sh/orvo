import {
  createGenerateChatTitle,
  normalizeChatTitle,
} from "$lib/server/services/chat/methods/generate-chat-title";
import { describe, expect, test, vi } from "vitest";

describe("chat titles", () => {
  test("uses a low-reasoning model with explicit title rules", async () => {
    const generate = vi.fn().mockResolvedValue({
      text: '"Investigate checkout latency."\nIgnored explanation',
    });
    const generateChatTitle = createGenerateChatTitle({
      model: {} as never,
      logger: { error: vi.fn() } as never,
      generate: generate as never,
    });

    const title = await generateChatTitle([
      {
        id: "message_1",
        role: "user",
        parts: [{ type: "text", text: "Why is checkout slow?" }],
      },
    ]);

    expect(title).toBe("Investigate checkout latency");
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: 32,
        providerOptions: { openai: { reasoningEffort: "low" } },
        system: expect.stringContaining("Use 3 to 7 words"),
        prompt: JSON.stringify({
          message: "Why is checkout slow?",
          attachments: [],
        }),
      }),
    );
  });

  test("includes attachment names as untrusted title context", async () => {
    const generate = vi.fn().mockResolvedValue({
      text: "Review checkout errors",
    });
    const generateChatTitle = createGenerateChatTitle({
      model: {} as never,
      logger: { error: vi.fn() } as never,
      generate: generate as never,
    });

    await generateChatTitle([
      {
        id: "message_1",
        role: "user",
        parts: [
          {
            type: "file",
            mediaType: "application/json",
            url: "https://files.test/checkout-errors.json",
            filename: "checkout-errors.json",
          },
        ],
      },
    ]);

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: JSON.stringify({
          message: null,
          attachments: ["checkout-errors.json"],
        }),
      }),
    );
  });

  test("falls back safely when there is no usable first message", async () => {
    const generate = vi.fn();
    const generateChatTitle = createGenerateChatTitle({
      model: {} as never,
      logger: { error: vi.fn() } as never,
      generate: generate as never,
    });

    expect(await generateChatTitle([])).toBe("New chat");
    expect(generate).not.toHaveBeenCalled();
  });

  test("normalizes model formatting and limits title length", () => {
    expect(normalizeChatTitle(`## ${"x".repeat(100)}!`)).toBe("x".repeat(72));
  });
});
