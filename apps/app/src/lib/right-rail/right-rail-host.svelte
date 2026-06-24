<script lang="ts">
  import * as Sheet from "@repo/components/ui/sheet";

  import { useRightRail } from "./right-rail.svelte";

  const rightRail = useRightRail();
</script>

{#if rightRail.active}
  <Sheet.Root
    bind:open={() => rightRail.isOpen, (open) => rightRail.setOpen(open)}
  >
    <Sheet.Content
      side="right"
      class={`w-full p-0 sm:max-w-none ${rightRail.active.widthClass} ${rightRail.active.className}`.trim()}
      showCloseButton={false}
    >
      {@render rightRail.active.children()}
    </Sheet.Content>
  </Sheet.Root>
{/if}
