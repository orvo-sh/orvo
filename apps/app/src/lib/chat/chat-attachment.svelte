<script lang="ts">
  import { resolve } from "$app/paths";
  import { IconFile } from "@tabler/icons-svelte";
  import type { FileUIPart } from "ai";

  let { file }: { file: FileUIPart } = $props();
</script>

{#if file.mediaType.startsWith("image/")}
  <a
    data-testid="chat-attachment"
    class="block overflow-hidden rounded-lg border bg-background"
    href={resolve(file.url)}
    target="_blank"
    rel="noreferrer"
  >
    <img
      class="max-h-64 w-auto max-w-full object-contain"
      src={file.url}
      alt={file.filename ?? "Chat attachment"}
    />
  </a>
{:else}
  <a
    data-testid="chat-attachment"
    class="flex max-w-64 items-center gap-2 rounded-lg border bg-background px-2.5 py-2 text-sm hover:bg-accent"
    href={resolve(file.url)}
    target="_blank"
    rel="noreferrer"
  >
    <IconFile class="size-4 shrink-0 text-muted-foreground" />
    <span class="truncate">{file.filename ?? "Attachment"}</span>
  </a>
{/if}
