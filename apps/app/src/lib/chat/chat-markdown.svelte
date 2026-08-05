<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import type { Snippet } from "svelte";
  import { Streamdown } from "svelte-streamdown";

  import { useChatState } from "./chat-state.svelte";

  let {
    content,
    streaming = false,
    chatId,
    messageId,
  }: {
    content: string;
    streaming?: boolean;
    chatId: string;
    messageId: string;
  } = $props();

  const chat = useChatState();

  const openTrace = async (href: string) => {
    const traceId = href.slice("orvo://trace/".length);
    if (!traceId) return;
    await goto(
      resolve(
        `/(dashboard)/a/[app_id]/traces/[trace_id]?chat=${encodeURIComponent(chatId)}&chat_message=${encodeURIComponent(messageId)}`,
        {
          app_id: chat.appId,
          trace_id: traceId,
        },
      ),
    );
  };

  const openExternal = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
  };
</script>

{#snippet link({
  children,
  token,
}: {
  children: Snippet;
  token: { href: string };
})}
  {#if token.href.startsWith("orvo://trace/")}
    <button
      type="button"
      class="font-medium text-primary underline decoration-primary/35 underline-offset-3 transition-colors hover:decoration-primary"
      onclick={() => openTrace(token.href)}
    >
      {@render children()}
    </button>
  {:else}
    <button
      type="button"
      class="font-medium text-primary underline decoration-primary/35 underline-offset-3 transition-colors hover:decoration-primary"
      onclick={() => openExternal(token.href)}
    >
      {@render children()}
    </button>
  {/if}
{/snippet}

<Streamdown
  {content}
  {link}
  static={!streaming}
  parseIncompleteMarkdown={true}
  baseTheme="shadcn"
  allowedLinkPrefixes={["https://", "http://", "orvo://"]}
  controls={{ code: true, table: true, mermaid: false }}
  animation={{
    enabled: streaming,
    animateOnMount: false,
    type: "fade",
    duration: 140,
    timingFunction: "ease-out",
    tokenize: "word",
  }}
  class="chat-markdown"
/>
