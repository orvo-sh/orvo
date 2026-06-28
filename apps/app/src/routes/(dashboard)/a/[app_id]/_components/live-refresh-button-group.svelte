<script lang="ts">
  import { cn } from "@repo/components";
  import { Button } from "@repo/components/ui/button";
  import * as ButtonGroup from "@repo/components/ui/button-group";
  import { IconReload } from "@tabler/icons-svelte";

  let {
    live = $bindable(),
    refresh,
    disabled = false,
  }: {
    live: boolean;
    refresh: () => Promise<void>;
    disabled?: boolean;
  } = $props();

  let isReloading = $state(false);
</script>

<ButtonGroup.Root>
  <Button
    {disabled}
    variant="outline"
    aria-label="Live mode"
    data-testid="live-refresh-toggle"
    onclick={() => (live = !live)}
  >
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
    {disabled}
    aria-label="Refresh data"
    data-testid="live-refresh-button"
    onclick={async () => {
      if (!refresh) return;
      isReloading = true;
      await refresh();
      isReloading = false;
    }}
  >
    <IconReload data-slot="button-icon" />
  </Button>
</ButtonGroup.Root>
