<script lang="ts">
  import { browser } from "$app/environment";
  import { Button } from "@repo/components/ui/button";
  import { IconArrowDown } from "@tabler/icons-svelte";
  import type { ChatStatus, UIMessage } from "ai";
  import { onMount } from "svelte";

  import ChatEmpty from "./chat-empty.svelte";
  import ChatMessage from "./chat-message.svelte";
  import { isChatScrollNearBottom } from "./chat-scroll";
  import type { ChatContextDescriptor } from "./types";

  let {
    messages,
    status,
    chatId,
    context,
    target,
    onSuggestion,
  }: {
    messages: UIMessage[];
    status: ChatStatus;
    chatId: string | null;
    context: ChatContextDescriptor | null;
    target: { chatId: string; messageId: string; nonce: number } | null;
    onSuggestion: (prompt: string) => void;
  } = $props();

  let viewport: HTMLDivElement;
  let content: HTMLDivElement;
  let following = $state(true);
  let programmaticUntil = 0;
  let programmaticTarget = 0;
  let lastTargetNonce = 0;
  let scrollFrame = 0;
  let seekFrame = 0;
  const streamSignature = $derived.by(() => {
    const lastPart = messages.at(-1)?.parts.at(-1);
    if (!lastPart) return `${messages.length}:${status}`;
    if (lastPart.type === "text" || lastPart.type === "reasoning") {
      return `${messages.length}:${status}:${lastPart.type}:${lastPart.text.length}`;
    }
    if (lastPart.type === "dynamic-tool") {
      return `${messages.length}:${status}:${lastPart.toolCallId}:${lastPart.state}`;
    }
    return `${messages.length}:${status}:${lastPart.type}`;
  });

  const scrollToBottom = () => {
    if (!browser || !viewport) return;
    programmaticTarget = Math.max(
      0,
      viewport.scrollHeight - viewport.clientHeight,
    );
    programmaticUntil = performance.now() + 160;
    viewport.scrollTop = viewport.scrollHeight;
    following = true;
  };

  const scheduleScrollToBottom = () => {
    if (!browser || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      scrollToBottom();
    });
  };

  const onScroll = () => {
    if (!viewport) return;
    if (isChatScrollNearBottom(viewport)) {
      following = true;
      return;
    }
    const isProgrammatic =
      performance.now() < programmaticUntil &&
      Math.abs(viewport.scrollTop - programmaticTarget) < 24;
    if (!isProgrammatic) following = false;
  };

  const onWheel = (event: WheelEvent) => {
    const nestedScrollable = (event.target as HTMLElement | null)?.closest(
      "[data-scrollable]",
    );
    if (nestedScrollable && nestedScrollable !== viewport) return;
    if (event.deltaY < 0) following = false;
  };

  const seekTarget = () => {
    if (
      !target ||
      target.chatId !== chatId ||
      target.nonce === lastTargetNonce
    ) {
      return;
    }
    lastTargetNonce = target.nonce;
    if (seekFrame) cancelAnimationFrame(seekFrame);
    seekFrame = requestAnimationFrame(() => {
      seekFrame = 0;
      const element = document.getElementById(
        `chat-message-${target.messageId}`,
      );
      if (!element) return;
      following = false;
      programmaticUntil = performance.now() + 220;
      element.scrollIntoView({ block: "center" });
      programmaticTarget = viewport.scrollTop;
    });
  };

  onMount(() => {
    const observer = new ResizeObserver(() => {
      if (following) scheduleScrollToBottom();
    });
    observer.observe(content);
    scheduleScrollToBottom();
    return () => {
      observer.disconnect();
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      if (seekFrame) cancelAnimationFrame(seekFrame);
    };
  });

  $effect(() => {
    if (
      streamSignature &&
      following &&
      (status === "submitted" || status === "streaming")
    ) {
      scheduleScrollToBottom();
    }
  });

  $effect(seekTarget);
</script>

<div class="relative min-h-0 flex-1 overflow-hidden">
  <div
    bind:this={viewport}
    data-testid="chat-message-list"
    class="chat-scroll h-full overflow-y-auto overscroll-contain"
    onscroll={onScroll}
    onwheel={onWheel}
    style:overflow-anchor={following ? "none" : "auto"}
  >
    <div bind:this={content} class="min-h-full">
      {#if messages.length === 0}
        <ChatEmpty {context} {onSuggestion} />
      {:else}
        <div
          class="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-5"
        >
          {#each messages as message, index (message.id)}
            <ChatMessage
              {message}
              chatId={chatId ?? "new"}
              streaming={(status === "streaming" || status === "submitted") &&
                index === messages.length - 1 &&
                message.role === "assistant"}
            />
          {/each}
          <div class="h-2" aria-hidden="true"></div>
        </div>
      {/if}
    </div>
  </div>

  {#if !following && messages.length}
    <Button
      variant="outline"
      size="icon-sm"
      class="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-background shadow-md"
      aria-label="Jump to latest message"
      onclick={scrollToBottom}
    >
      <IconArrowDown />
    </Button>
  {/if}
</div>
