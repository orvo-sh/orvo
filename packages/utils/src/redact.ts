const redact = (
  text: string,
  replacementChar = "*",
  revealChars = 4,
  direction: "start" | "end" = "start",
) => {
  if (!text) return "";
  const visible = Math.max(0, revealChars);
  if (text.length <= visible) return text;
  const redacted = (replacementChar[0] ?? "*").repeat(text.length - visible);
  if (direction === "start") return `${text.slice(0, visible)}${redacted}`;
  return `${redacted}${text.slice(-visible)}`;
};

export { redact };
