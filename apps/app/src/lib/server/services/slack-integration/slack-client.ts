const callSlack = async <T extends Record<string, unknown>>(
  token: string,
  method: string,
  body: Record<string, unknown>,
) => {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const result = (await response.json().catch(() => null)) as
    | ({ ok: true } & T)
    | { ok: false; error?: string }
    | null;

  if (!response.ok || !result?.ok) {
    throw new Error(
      `Slack ${method} failed: ${result && "error" in result ? result.error : response.status}`,
    );
  }

  return result;
};

const postSlackMessage = (
  token: string,
  input: {
    channel: string;
    text: string;
    threadTs?: string;
    blocks?: Array<Record<string, unknown>>;
  },
) =>
  callSlack<{ channel: string; ts: string }>(token, "chat.postMessage", {
    channel: input.channel,
    text: input.text,
    ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
    ...(input.blocks ? { blocks: input.blocks } : {}),
  });

const postSlackEphemeral = (
  token: string,
  input: {
    channel: string;
    user: string;
    text: string;
    threadTs?: string;
    blocks?: Array<Record<string, unknown>>;
  },
) =>
  callSlack(token, "chat.postEphemeral", {
    channel: input.channel,
    user: input.user,
    text: input.text,
    ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
    ...(input.blocks ? { blocks: input.blocks } : {}),
  });

const startSlackStream = (
  token: string,
  input: {
    channel: string;
    threadTs: string;
    teamId: string;
    userId: string;
    markdownText: string;
  },
) =>
  callSlack<{ channel: string; ts: string }>(token, "chat.startStream", {
    channel: input.channel,
    thread_ts: input.threadTs,
    recipient_team_id: input.teamId,
    recipient_user_id: input.userId,
    markdown_text: input.markdownText,
  });

const appendSlackStream = (
  token: string,
  input: { channel: string; ts: string; markdownText: string },
) =>
  callSlack(token, "chat.appendStream", {
    channel: input.channel,
    ts: input.ts,
    markdown_text: input.markdownText,
  });

const stopSlackStream = (
  token: string,
  input: { channel: string; ts: string },
) => callSlack(token, "chat.stopStream", input);

const setSlackAgentStatus = (
  token: string,
  input: {
    channelId: string;
    threadTs: string;
    status: "processing" | "active" | "suspended" | "closed";
    title?: string;
  },
) =>
  callSlack(token, "agents.sessions.setStatus", {
    channel_id: input.channelId,
    thread_ts: input.threadTs,
    status: input.status,
    ...(input.title ? { title: input.title } : {}),
  });

const setSlackAssistantStatus = (
  token: string,
  input: { channelId: string; threadTs: string; status: string },
) =>
  callSlack(token, "assistant.threads.setStatus", {
    channel_id: input.channelId,
    thread_ts: input.threadTs,
    status: input.status,
  });

const toSlackMarkdown = (value: string, traceBaseUrl?: string) =>
  value
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
    .replace(/\[([^\]]+)]\((https?:\/\/[^)]+)\)/g, "<$2|$1>")
    .replace(
      /\[([^\]]+)]\(orvo:\/\/trace\/([^)]+)\)/g,
      traceBaseUrl ? `<${traceBaseUrl}$2|$1>` : "$1 (`$2`)",
    );

export {
  appendSlackStream,
  postSlackEphemeral,
  postSlackMessage,
  setSlackAgentStatus,
  setSlackAssistantStatus,
  startSlackStream,
  stopSlackStream,
  toSlackMarkdown,
};
