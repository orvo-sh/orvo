<script lang="ts">
  import { cn } from "@repo/components";
  import { buttonVariants } from "@repo/components/ui/button";
  import * as Popover from "@repo/components/ui/popover";
  import { Separator } from "@repo/components/ui/separator";
  import {
    IconArrowsDownUp as SortIcon,
    IconCheck as CheckIcon,
    IconChevronDown as CaretDownIcon,
  } from "@tabler/icons-svelte";

  let {
    sortBy = $bindable("timestamp"),
    sortOrder = $bindable("desc"),
  }: {
    sortBy?: "timestamp" | "severity" | "service";
    sortOrder?: "desc" | "asc";
  } = $props();

  let open = $state(false);

  const sortByOptions = [
    { value: "timestamp", label: "Timestamp" },
    { value: "severity", label: "Severity" },
    { value: "service", label: "Service" },
  ] as const;

  const sortOrderOptions = [
    { value: "desc", label: "Desc" },
    { value: "asc", label: "Asc" },
  ] as const;
</script>

<Popover.Root bind:open>
  <Popover.Trigger class={buttonVariants({ variant: "outline" })}>
    <SortIcon data-slot="button-icon" class="size-4" />
    <span class="text-foreground not-md:hidden">
      {sortByOptions.find((option) => option.value === sortBy)?.label} · {sortOrderOptions.find(
        (option) => option.value === sortOrder,
      )?.label}
    </span>
    <CaretDownIcon class="ml-0.5 size-3 text-muted-foreground not-sm:hidden" />
  </Popover.Trigger>

  <Popover.Content
    class="w-64 gap-1 p-1"
    align="end"
    side="bottom"
    sideOffset={9}
  >
    <div class="flex flex-col gap-0.5">
      {#each sortByOptions as option (option.value)}
        <button
          type="button"
          onclick={() => {
            sortBy = option.value;
            open = false;
          }}
          class={cn(
            "relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden transition-colors select-none",
            option.value === sortBy
              ? "bg-muted text-accent-foreground"
              : "text-foreground hover:bg-muted hover:text-accent-foreground",
          )}
        >
          <span
            class="absolute inset-e-2 flex size-4 items-center justify-center"
          >
            {#if option.value === sortBy}
              <CheckIcon class="size-4" />
            {/if}
          </span>
          {option.label}
        </button>
      {/each}
    </div>
    <Separator />
    <div class="flex flex-col gap-0.5">
      {#each sortOrderOptions as option (option.value)}
        <button
          type="button"
          onclick={() => {
            sortOrder = option.value;
            open = false;
          }}
          class={cn(
            "relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden transition-colors select-none",
            option.value === sortOrder
              ? "bg-muted text-accent-foreground"
              : "text-foreground hover:bg-muted hover:text-accent-foreground",
          )}
        >
          <span
            class="absolute inset-e-2 flex size-4 items-center justify-center"
          >
            {#if option.value === sortOrder}
              <CheckIcon class="size-4" />
            {/if}
          </span>
          {option.label}
        </button>
      {/each}
    </div>
  </Popover.Content>
</Popover.Root>
