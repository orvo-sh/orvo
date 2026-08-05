<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { cn } from "@repo/components";
  import { Button } from "@repo/components/ui/button";
  import { IconMessage, IconTrash } from "@tabler/icons-svelte";

  import { useChatState } from "./chat-state.svelte";

  let {
    mode = "page",
    onSelect,
  }: { mode?: "page" | "popover"; onSelect?: () => void } = $props();

  const chat = useChatState();

  const select = async (id: string) => {
    await chat.openChat(id, { rail: mode === "popover" });
    onSelect?.();
    if (mode === "page") {
      await goto(
        resolve("/(dashboard)/a/[app_id]/chat/[chat_id]", {
          app_id: chat.appId,
          chat_id: id,
        }),
      );
    }
  };

  const remove = async (event: MouseEvent, id: string) => {
    event.stopPropagation();
    if (await chat.deleteChat(id)) {
      if (mode === "page" && page.url.pathname.endsWith(`/${id}`)) {
        await goto(
          resolve("/(dashboard)/a/[app_id]/chat", {
            app_id: chat.appId,
          }),
        );
      }
    }
  };
</script>

<div
  class={cn(
    "min-h-0 overflow-y-auto",
    mode === "page" ? "flex-1 p-2" : "max-h-80",
  )}
  data-scrollable
>
  {#if chat.historyLoading && !chat.threads.length}
    <div class="space-y-1.5 p-1">
      {#each [0, 1, 2, 3, 4] as index (index)}
        <div class="h-10 animate-pulse rounded-lg bg-muted"></div>
      {/each}
    </div>
  {:else if chat.historyError && !chat.threads.length}
    <div class="px-4 py-8 text-center text-xs text-destructive">
      {chat.historyError}
    </div>
  {:else if !chat.threads.length}
    <div
      class="flex flex-col items-center px-4 py-8 text-center text-muted-foreground"
    >
      <IconMessage class="mb-2 size-5 opacity-60" />
      <p class="text-xs">No conversations yet</p>
    </div>
  {:else}
    <div class="space-y-0.5">
      {#each chat.threads as thread (thread.id)}
        <div class="group/history relative">
          <button
            type="button"
            class={cn(
              "w-full rounded-lg px-2.5 py-2 pr-8 text-left transition-colors hover:bg-muted",
              chat.activeChatId === thread.id && "bg-muted",
            )}
            onclick={() => select(thread.id)}
          >
            <span class="block truncate text-xs font-medium text-foreground">
              {thread.title}
            </span>
            <span
              class="mt-0.5 block truncate text-[10px] text-muted-foreground"
            >
              {thread.contexts[0]
                ? `${thread.contexts[0].kind}: ${thread.contexts[0].label}`
                : new Date(thread.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon-xs"
            class="absolute top-2 right-1.5 opacity-0 group-hover/history:opacity-100 focus-visible:opacity-100"
            aria-label={`Delete ${thread.title}`}
            onclick={(event) => remove(event, thread.id)}
          >
            <IconTrash />
          </Button>
        </div>
      {/each}
    </div>
  {/if}
</div>
