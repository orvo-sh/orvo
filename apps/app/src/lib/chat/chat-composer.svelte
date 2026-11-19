<script lang="ts">
  import {
    CHAT_ATTACHMENT_MEDIA_TYPES,
    MAX_CHAT_ATTACHMENTS,
    MAX_UPLOAD_FILE_SIZE_BYTES,
  } from "$lib/constants";
  import { fade } from "svelte/transition";
  import { Button } from "@repo/components/ui/button";
  import { Textarea } from "@repo/components/ui/textarea";
  import {
    IconArrowUp,
    IconFile,
    IconPaperclip,
    IconPlayerStopFilled,
    IconX,
  } from "@tabler/icons-svelte";

  import { useChatState } from "./chat-state.svelte";

  const chat = useChatState();

  let {
    status,
    onSend,
    onStop,
    centered = false,
    compact = false,
    suggestions = [],
  }: {
    status: string;
    onSend: (text: string, files: File[]) => Promise<boolean>;
    onStop: () => Promise<void> | void;
    centered?: boolean;
    compact?: boolean;
    suggestions?: Array<{ label: string; prompt: string }>;
  } = $props();

  const fadeSuggestions = (node: Element) =>
    fade(node, {
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 180,
    });

  let value = $state("");
  let messageInput = $state<HTMLTextAreaElement | null>(null);
  $effect(() => {
    if (chat.composerPrompt !== null) {
      value = chat.composerPrompt;
      chat.composerPrompt = null;
    }
  });
  let files = $state<File[]>([]);
  let uploading = $state(false);
  let fileInput: HTMLInputElement;
  const busy = $derived(
    uploading || status === "submitted" || status === "streaming",
  );

  const submit = async () => {
    const text = value.trim();
    if ((!text && !files.length) || busy) return;
    uploading = true;
    const sent = await onSend(text, files).finally(() => (uploading = false));
    if (!sent) return;
    value = "";
    files = [];
    if (fileInput) fileInput.value = "";
  };

  const selectFiles = (event: Event) => {
    const selected = Array.from(
      (event.currentTarget as HTMLInputElement).files ?? [],
    ).filter(
      (file) =>
        CHAT_ATTACHMENT_MEDIA_TYPES.includes(
          file.type as (typeof CHAT_ATTACHMENT_MEDIA_TYPES)[number],
        ) && file.size <= MAX_UPLOAD_FILE_SIZE_BYTES,
    );
    files = [...files, ...selected].slice(0, MAX_CHAT_ATTACHMENTS);
    if (fileInput) fileInput.value = "";
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void submit();
    }
  };
</script>

{#snippet suggestionChips()}
  {#if suggestions.length}
    <div
      role="group"
      aria-label="Suggested prompts"
      data-testid="chat-suggested-prompts"
      class={[
        "z-10 flex flex-wrap gap-2 bg-background py-2 transition-opacity duration-200 motion-reduce:transition-none",
        centered ? "absolute inset-x-0 top-full mt-1" : "relative",
      ]}
      transition:fadeSuggestions
      style:opacity={value.trim() || files.length ? 0 : 1}
      inert={!!value.trim() || files.length > 0}
      aria-hidden={!!value.trim() || files.length > 0}
    >
      {#each suggestions as suggestion}
        <Button
          type="button"
          variant="outline"
          size="xs"
          class="h-auto min-h-7 max-w-full rounded-lg px-3 py-1.5 text-left leading-snug whitespace-normal text-secondary-foreground shadow-none not-disabled:inset-shadow-none"
          disabled={busy}
          onclick={() => {
            value = suggestion.prompt;
            messageInput?.focus();
          }}
        >
          {suggestion.label}
        </Button>
      {/each}
    </div>
  {/if}
{/snippet}

<div
  class="relative z-10 w-full shrink-0 bg-background px-3 py-3 pt-0! sm:px-4 sm:py-4"
  class:flex-1={centered}
  class:flex={centered}
  class:flex-col={centered}
  class:items-center={centered}
  class:justify-center={centered}
>
  {#if !centered}
    <div
      aria-hidden="true"
      data-testid="chat-composer-fade"
      class="pointer-events-none absolute inset-x-0 bottom-full h-6 bg-linear-to-t from-background to-transparent"
    ></div>
  {/if}
  {#if centered}
    <h2
      class="-mt-[10%] mb-6 text-center font-medium tracking-tight text-foreground"
      class:text-lg={compact}
      class:text-2xl={!compact}
    >
      What can Scout help with today?
    </h2>
  {/if}
  <div class="relative mx-auto w-full max-w-3xl">
    {#if !centered}
      <div
        class="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        style:grid-template-rows={suggestions.length &&
        !value.trim() &&
        !files.length
          ? "1fr"
          : "0fr"}
      >
        <div class="min-h-0 overflow-hidden">
          {@render suggestionChips()}
        </div>
      </div>
    {/if}
    <form
      data-testid="chat-composer"
      class="mx-auto w-full max-w-3xl rounded-2xl border bg-card p-1.5 shadow-[0_10px_30px_-18px_hsl(var(--foreground)/0.35)] transition-[border-color,box-shadow] focus-within:border-ring/50 focus-within:shadow-[0_14px_38px_-20px_hsl(var(--foreground)/0.4)]"
      onsubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {#if files.length}
        <div class="flex flex-wrap gap-1.5 px-1.5 pt-1">
          {#each files as file, index (`${file.name}-${file.size}-${index}`)}
            <div
              class="flex max-w-52 items-center gap-1.5 rounded-lg border bg-muted/45 py-1 pr-1 pl-2 text-sm"
            >
              <IconFile class="size-3.5 shrink-0 text-muted-foreground" />
              <span class="truncate">{file.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${file.name}`}
                onclick={() =>
                  (files = files.filter((_, item) => item !== index))}
              >
                <IconX />
              </Button>
            </div>
          {/each}
        </div>
      {/if}
      <Textarea
        bind:ref={messageInput}
        bind:value
        rows={1}
        class="field-sizing-content max-h-40 min-h-10 resize-none border-0 bg-transparent px-2.5 py-2 text-sm leading-5 shadow-none focus-visible:ring-0"
        placeholder="Ask Scout about your telemetry"
        aria-label="Message Scout"
        onkeydown={onKeydown}
      />
      <div class="flex items-center justify-between gap-2 px-1 pb-0.5">
        <input
          bind:this={fileInput}
          class="sr-only"
          type="file"
          accept={CHAT_ATTACHMENT_MEDIA_TYPES.join(",")}
          multiple
          onchange={selectFiles}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          class="rounded-xl"
          disabled={busy || files.length >= MAX_CHAT_ATTACHMENTS}
          aria-label="Attach files"
          onclick={() => fileInput.click()}
        >
          <IconPaperclip data-slot="button-icon" />
        </Button>
        {#if uploading}
          <Button
            type="button"
            size="icon-sm"
            class="rounded-xl"
            loading
            aria-label="Uploading attachments"
          >
            <IconArrowUp data-slot="button-icon" />
          </Button>
        {:else if status === "submitted" || status === "streaming"}
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
            disabled={!value.trim() && !files.length}
            aria-label="Send message"
          >
            <IconArrowUp data-slot="button-icon" />
          </Button>
        {/if}
      </div>
    </form>
    {#if centered}
      {@render suggestionChips()}
    {/if}
  </div>
</div>
