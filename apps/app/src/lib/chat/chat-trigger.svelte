<script lang="ts">
  import { Button } from "@repo/components/ui/button";
  import { IconSparkles } from "@tabler/icons-svelte";

  import { useChatState } from "./chat-state.svelte";
  import type { ChatContextDescriptor } from "./types";

  let {
    context,
    onOpen,
  }: { context: ChatContextDescriptor; onOpen?: () => void } = $props();
  const chat = useChatState();
</script>

<Button
  data-testid="chat-trigger"
  variant="outline"
  size="sm"
  onclick={() => {
    onOpen?.();
    void chat.openContext(context);
  }}
>
  <IconSparkles data-slot="button-icon" />
  Ask Scout
</Button>
