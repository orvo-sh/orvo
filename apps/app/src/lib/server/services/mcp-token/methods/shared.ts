import { createHmac, timingSafeEqual } from "node:crypto";

const createMcpTokenHash = (secret: string, tokenSecret: string) =>
  createHmac("sha256", secret).update(tokenSecret).digest("hex");

const compareMcpTokenHash = (
  secret: string,
  tokenSecret: string,
  expectedHash: string,
) => {
  const actual = Buffer.from(createMcpTokenHash(secret, tokenSecret), "utf8");
  const expected = Buffer.from(expectedHash, "utf8");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
};

const createMcpTokenSecret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(48)))
    .map((value) => "abcdefghijklmnopqrstuvwxyz0123456789"[value % 36])
    .join("");

const clipText = (value: string | null | undefined, maxLength: number) =>
  typeof value === "string" && value.length > 0
    ? value.slice(0, maxLength)
    : null;

export {
  clipText,
  compareMcpTokenHash,
  createMcpTokenHash,
  createMcpTokenSecret,
};
