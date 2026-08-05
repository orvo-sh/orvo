import { describe, expect, it } from "vitest";

import { deriveChatTitle } from "$lib/server/services/chat/methods/shared";

describe("chat titles", () => {
  it("uses the first user message and normalizes whitespace", () => {
    expect(
      deriveChatTitle([
        { role: "assistant", parts: [{ type: "text", text: "Earlier" }] },
        {
          role: "user",
          parts: [{ type: "text", text: "  Why did\ncheckout   slow down?  " }],
        },
      ]),
    ).toBe("Why did checkout slow down?");
  });

  it("keeps long titles compact", () => {
    const title = deriveChatTitle([
      { role: "user", parts: [{ type: "text", text: "x".repeat(100) }] },
    ]);

    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBe(72);
  });
});
