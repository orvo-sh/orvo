<script lang="ts">
  import { Button } from "@repo/components/ui/button";
  import { Spinner } from "@repo/components/ui/spinner";
  import { IconBrain, IconCheck, IconCopy } from "@tabler/icons-svelte";
  import type { UIMessage } from "ai";

  import ChatMarkdown from "./chat-markdown.svelte";
  import ChatToolPart from "./chat-tool-part.svelte";

  let {
    message,
    chatId,
    streaming = false,
  }: { message: UIMessage; chatId: string; streaming?: boolean } = $props();

  let copied = $state(false);
  const text = $derived(
    message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n\n"),
  );

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 1400);
  };
</script>

<article
  id={`chat-message-${message.id}`}
  data-chat-message={message.id}
  class="group/message w-full scroll-m-24"
  class:flex={message.role === "user"}
  class:justify-end={message.role === "user"}
>
  {#if message.role === "user"}
    <div
      class="max-w-[86%] rounded-2xl rounded-br-md bg-muted px-3.5 py-2.5 text-[13px] leading-5 text-foreground sm:max-w-[75%]"
    >
      {#each message.parts as part, index (`${part.type}-${index}`)}
        {#if part.type === "text"}{part.text}{/if}
      {/each}
    </div>
  {:else}
    <div class="min-w-0 text-[13px] leading-6 text-foreground">
      {#each message.parts as part, index (`${part.type}-${index}`)}
        {#if part.type === "text"}
          <ChatMarkdown
            content={part.text}
            {chatId}
            messageId={message.id}
            streaming={streaming && index === message.parts.length - 1}
          />
        {:else if part.type === "reasoning"}
          <details class="group/reasoning my-2 text-xs text-muted-foreground">
            <summary
              class="flex cursor-pointer list-none items-center gap-2 py-1.5 select-none hover:text-foreground"
            >
              {#if streaming && part.state !== "done"}<Spinner
                  class="size-3.5"
                />{:else}<IconBrain class="size-3.5" />{/if}
              <span
                >{streaming && part.state !== "done"
                  ? "Thinking"
                  : "Reasoning"}</span
              >
            </summary>
            <div
              class="border-l pl-3 text-[12px] leading-5 whitespace-pre-wrap"
            >
              {part.text}
            </div>
          </details>
        {:else if part.type === "dynamic-tool"}
          <ChatToolPart {part} {chatId} messageId={message.id} />
        {/if}
      {/each}

      {#if streaming && message.parts.length === 0}
        <div class="flex items-center gap-2 py-1 text-xs text-muted-foreground">
          <Spinner class="size-3.5" /> Thinking
        </div>
      {/if}

      {#if text && !streaming}
        <Button
          variant="ghost"
          size="icon-xs"
          class="mt-1 opacity-0 transition-opacity group-hover/message:opacity-100 focus-visible:opacity-100"
          aria-label="Copy response"
          onclick={copy}
        >
          {#if copied}<IconCheck />{:else}<IconCopy />{/if}
        </Button>
      {/if}
    </div>
  {/if}
</article>
