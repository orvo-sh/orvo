<script lang="ts">
  import { cn } from "@repo/components";
  import { buttonVariants } from "@repo/components/ui/button";
  import * as Popover from "@repo/components/ui/popover";
  import {
    IconCheck as CheckIcon,
    IconChevronDown as ChevronDownIcon,
  } from "@tabler/icons-svelte";

  type LevelFilterOption = {
    value: string;
    label: string;
    colorClass: string;
  };

  let {
    label,
    values = $bindable<string[]>([]),
    options,
  }: {
    label: string;
    values?: string[];
    options: LevelFilterOption[];
  } = $props();

  let open = $state(false);

  const optionValues = $derived(options.map((option) => option.value));
  const selectedValues = $derived(values.length > 0 ? values : optionValues);
  const selectedCount = $derived(selectedValues.length);

  const isSelected = (value: string) => selectedValues.includes(value);

  const toggle = (value: string) => {
    const nextValues = isSelected(value)
      ? selectedValues.filter((selectedValue) => selectedValue !== value)
      : [...selectedValues, value];

    if (nextValues.length === 0) {
      return;
    }

    values = nextValues.length === options.length ? [] : nextValues;
  };
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    class={buttonVariants({
      size: "default",
      class: cn(
        "items-center gap-2 border-border bg-background pr-2.5 text-secondary-foreground shadow-none hover:bg-background",
      ),
      variant: "outline",
    })}
  >
    <span class="flex -space-x-1">
      {#each options as option}
        <span
          class={cn(
            "size-2.5 rounded-full ring-2 ring-background",
            option.colorClass,
            !isSelected(option.value) && "bg-muted opacity-60",
          )}
        ></span>
      {/each}
    </span>
    <span class="text-sm font-normal">{label}</span>
    <span
      class="rounded-full bg-muted px-2 py-0.5 text-xs leading-none font-semibold text-foreground"
    >
      {selectedCount}/{options.length}
    </span>
    <ChevronDownIcon class="size-4 text-muted-foreground" />
  </Popover.Trigger>

  <Popover.Content class="w-56 gap-0 rounded-xl p-2" align="start">
    <div class="flex flex-col gap-1">
      {#each options as option}
        {@const selected = isSelected(option.value)}
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/70"
          onclick={() => toggle(option.value)}
        >
          <span
            class={cn(
              "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-muted-foreground/50 bg-background text-transparent",
            )}
          >
            <CheckIcon class="size-3" />
          </span>
          <span class={cn("size-2.5 shrink-0 rounded-full", option.colorClass)}
          ></span>
          <span class="truncate text-foreground">{option.label}</span>
        </button>
      {/each}
    </div>
  </Popover.Content>
</Popover.Root>
