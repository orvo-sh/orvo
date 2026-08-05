<script lang="ts">
  import { Button } from "@repo/components/ui/button";
  import { Textarea } from "@repo/components/ui/textarea";
  import { IconArrowUp, IconPlayerStopFilled } from "@tabler/icons-svelte";

  let {
    status,
    contextLabel,
    onSend,
    onStop,
  }: {
    status: string;
    contextLabel?: string;
    onSend: (text: string) => Promise<void> | void;
    onStop: () => Promise<void> | void;
  } = $props();

  let value = $state("");
  const busy = $derived(status === "submitted" || status === "streaming");

  const submit = async () => {
    const text = value.trim();
    if (!text || busy) return;
    value = "";
    await onSend(text);
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void submit();
    }
  };
</script>

<div class="shrink-0 bg-background px-3 pt-2 pb-3 sm:px-4 sm:pb-4">
  <form
    data-testid="chat-composer"
    class="mx-auto max-w-3xl rounded-2xl border bg-card p-1.5 shadow-[0_10px_30px_-18px_hsl(var(--foreground)/0.35)] transition-[border-color,box-shadow] focus-within:border-ring/50 focus-within:shadow-[0_14px_38px_-20px_hsl(var(--foreground)/0.4)]"
    onsubmit={(event) => {
      event.preventDefault();
      void submit();
    }}
  >
    <Textarea
      bind:value
      rows={1}
      class="field-sizing-content max-h-40 min-h-10 resize-none border-0 bg-transparent px-2.5 py-2 text-[13px] leading-5 shadow-none focus-visible:ring-0"
      placeholder={contextLabel
        ? `Ask about ${contextLabel}`
        : "Ask Scout about your telemetry"}
      aria-label="Message Scout"
      onkeydown={onKeydown}
    />
    <div class="flex items-center justify-between gap-2 px-1 pb-0.5">
      <span class="truncate px-1 text-[10px] text-muted-foreground">
        {contextLabel
          ? `Context: ${contextLabel}`
          : "Read-only access to this app"}
      </span>
      {#if busy}
        <Button
          type="button"
          size="icon-sm"
          class="rounded-xl"
          aria-label="Stop response"
          onclick={onStop}
        >
          <IconPlayerStopFilled class="size-3" data-slot="button-icon" />
        </Button>
      {:else}
        <Button
          type="submit"
          size="icon-sm"
          class="rounded-xl"
          disabled={!value.trim()}
          aria-label="Send message"
        >
          <IconArrowUp data-slot="button-icon" />
        </Button>
      {/if}
    </div>
  </form>
  <p class="mt-1.5 text-center text-[10px] text-muted-foreground/75">
    Scout can make mistakes. Verify important findings.
  </p>
</div>
