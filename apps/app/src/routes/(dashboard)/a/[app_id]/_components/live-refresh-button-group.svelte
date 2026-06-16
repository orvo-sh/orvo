<script lang="ts">
  import { cn } from "@repo/components";
  import { Button } from "@repo/components/ui/button";
  import * as ButtonGroup from "@repo/components/ui/button-group";
  import { IconReload } from "@tabler/icons-svelte";

  let {
    live = $bindable(),
    refresh,
  }: {
    live: boolean;
    refresh: () => Promise<void>;
  } = $props();

  let isReloading = $state(false);
</script>

<ButtonGroup.Root>
  <Button variant="outline" onclick={() => (live = !live)}>
    <span
      data-slot="button-icon"
      class="relative mt-px flex size-4 items-center justify-center"
    >
      <span
        class={cn(
          "absolute inline-flex size-2.5 animate-ping rounded-full bg-primary/30",
          live ? "flex" : "hidden",
        )}
      ></span>
      <span
        class={cn(
          "relative inline-flex size-2.5 rounded-full transition-colors",
          live ? "bg-primary" : "bg-foreground/50",
        )}
      ></span>
    </span>
    Live mode
  </Button>
  <Button
    variant="outline"
    size="icon"
    loading={isReloading}
    onclick={async () => {
      isReloading = true;
      await refresh();
      isReloading = false;
    }}
  >
    <IconReload data-slot="button-icon" />
  </Button>
</ButtonGroup.Root>
