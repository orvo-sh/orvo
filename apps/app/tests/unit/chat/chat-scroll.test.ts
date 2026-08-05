import { describe, expect, it } from "vitest";

import {
  getChatScrollDistanceFromBottom,
  isChatScrollNearBottom,
} from "$lib/chat/chat-scroll";

describe("chat scroll following", () => {
  it("measures the remaining distance without rounding streamed layout", () => {
    expect(
      getChatScrollDistanceFromBottom({
        scrollHeight: 1_250.5,
        clientHeight: 500,
        scrollTop: 700.25,
      }),
    ).toBe(50.25);
  });

  it("resumes following only inside the bottom threshold", () => {
    expect(
      isChatScrollNearBottom({
        scrollHeight: 1_000,
        clientHeight: 400,
        scrollTop: 590,
      }),
    ).toBe(true);
    expect(
      isChatScrollNearBottom({
        scrollHeight: 1_000,
        clientHeight: 400,
        scrollTop: 589,
      }),
    ).toBe(false);
  });
});
