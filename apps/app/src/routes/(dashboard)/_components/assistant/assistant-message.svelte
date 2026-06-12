<script lang="ts">
  import { cn } from "@repo/components";
  import { getToolName, isToolUIPart, type UIMessage } from "ai";
  import {
    IconCheck,
    IconDatabaseSearch,
    IconSparkles,
    IconX,
  } from "@tabler/icons-svelte";

  let {
    message,
    compact = false,
    streaming = false,
  }: {
    message: UIMessage;
    compact?: boolean;
    streaming?: boolean;
  } = $props();

  const toolLabels: Record<string, string> = {
    getAppOverview: "Checking app",
    getLogVolume: "Reading log volume",
    searchLogs: "Searching logs",
    getRecentErrors: "Finding errors",
    searchTraces: "Searching traces",
    getTraceDetails: "Inspecting trace",
    getSlowTraces: "Finding slow traces",
    getAlertCoverage: "Reviewing alerts",
  };

  const formatToolName = (name: string) =>
    name
      .replace(/^get/, "")
      .replace(/^search/, "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .trim()
      .toLowerCase();

  const splitText = (text: string) =>
    text
      .split(/(\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)]+|\/a\/[^\s)]+)/g)
      .filter(Boolean)
      .map((part) => {
        const markdownLink = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (markdownLink) {
          const [, label, href] = markdownLink;
          return { type: "link" as const, label, href };
        }

        if (
          part.startsWith("http://") ||
          part.startsWith("https://") ||
          part.startsWith("/a/")
        ) {
          return { type: "link" as const, label: part, href: part };
        }

        return { type: "text" as const, text: part };
      });
</script>

<div class="group/message w-full" data-message-role={message.role}>
  <div
    class="flex w-full min-w-0 {message.role === 'assistant'
      ? 'gap-3'
      : 'gap-0'}"
  >
    {#if message.role === "assistant"}
      <div class="flex shrink-0 pt-0.5">
        <div
          class={cn(
            "flex shrink-0 items-center justify-center rounded-lg border bg-background text-foreground shadow-sm",
            compact ? "size-6" : "size-7",
          )}
        >
          <IconSparkles class={compact ? "size-3" : "size-3.5"} />
        </div>
      </div>
    {/if}

    <div
      class={cn(
        "flex min-w-0 flex-1 flex-col gap-1",
        message.role === "user" ? "items-end" : "items-start",
      )}
    >
      <div class="flex w-full min-w-0 flex-col gap-2">
        {#each message.parts as part}
          {#if part.type === "text"}
            {#if message.role === "user"}
              <div class="flex w-full justify-end">
                <div
                  class="rounded-xl rounded-tr-sm bg-secondary px-4 py-2 text-foreground shadow-sm"
                >
                  <p class="text-sm leading-6 whitespace-pre-wrap">
                    {#each splitText(part.text) as token}
                      {#if token.type === "link"}
                        <a
                          href={token.href}
                          class="font-medium text-foreground underline underline-offset-4"
                        >
                          {token.label}
                        </a>
                      {:else}
                        {token.text}
                      {/if}
                    {/each}
                  </p>
                </div>
              </div>
            {:else}
              <div class="text-sm leading-7 text-foreground">
                {#each splitText(part.text) as token}
                  {#if token.type === "link"}
                    <a
                      href={token.href}
                      class="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                      {token.label}
                    </a>
                  {:else}
                    {token.text}
                  {/if}
                {/each}
              </div>
            {/if}
          {:else if isToolUIPart(part)}
            {@const toolName = getToolName(part)}
            {@const isLoadingState =
              part.state !== "output-available" &&
              part.state !== "output-error"}
            {@const isErrorState = part.state === "output-error"}
            <div
              class="flex w-fit flex-col overflow-hidden rounded-lg border border-border/60 bg-muted/35"
            >
              <div
                class="flex h-full min-w-0 items-center gap-2 px-4 py-1.5 pl-3"
              >
                {#if isLoadingState}
                  <div
                    class="relative inline-flex size-4 shrink-0 items-center justify-center"
                  >
                    <div class="size-2 rounded-full bg-blue-500"></div>
                    <div
                      class="absolute top-0 left-0 size-4 animate-ping rounded-full bg-blue-500/40"
                    ></div>
                    <div
                      class="absolute top-0 left-0 size-4 animate-pulse rounded-full bg-blue-500/25"
                    ></div>
                  </div>
                {:else if isErrorState}
                  <div
                    class="flex size-4 items-center justify-center rounded-full bg-red-600"
                  >
                    <IconX class="size-3 shrink-0 text-white" />
                  </div>
                {:else}
                  <div
                    class="flex size-4 items-center justify-center rounded-full bg-green-600"
                  >
                    <IconCheck class="size-3 shrink-0 text-white" />
                  </div>
                {/if}
                <span
                  class="min-w-0 truncate text-center text-sm leading-5 font-medium text-muted-foreground"
                >
                  {toolLabels[toolName] ?? formatToolName(toolName)}
                </span>
              </div>
            </div>
          {:else if part.type === "reasoning" && part.text}
            <div
              class="rounded-lg border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground"
            >
              {part.text}
            </div>
          {:else if part.type === "source-url"}
            <a
              href={part.url}
              class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-muted"
            >
              <IconDatabaseSearch class="size-3" />
              {part.title ?? part.url}
            </a>
          {/if}
        {/each}

        {#if streaming && message.role === "assistant"}
          <div
            class="flex w-fit items-center rounded-2xl bg-muted/60 px-4 py-3"
          >
            <span
              class="inline-flex w-8 items-center justify-center gap-1 text-muted-foreground"
              aria-hidden="true"
            >
              <span class="thinking-dot thinking-dot-1"></span>
              <span class="thinking-dot thinking-dot-2"></span>
              <span class="thinking-dot thinking-dot-3"></span>
            </span>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .thinking-dot {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 9999px;
    background: currentColor;
    opacity: 0.2;
    animation: thinking-dot-pulse 1.8s ease-in-out infinite;
  }
  .thinking-dot-1 {
    animation-delay: 0s;
  }
  .thinking-dot-2 {
    animation-delay: 0.2s;
  }
  .thinking-dot-3 {
    animation-delay: 0.4s;
  }
  @keyframes thinking-dot-pulse {
    0% {
      opacity: 0.2;
    }
    22% {
      opacity: 0.9;
    }
    44%,
    100% {
      opacity: 0.2;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .thinking-dot-1,
    .thinking-dot-2,
    .thinking-dot-3 {
      animation: none;
    }
  }
</style>
