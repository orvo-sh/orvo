<script lang="ts" module>
  type FilterBuilderOperator =
    | "eq"
    | "neq"
    | "contains"
    | "not_contains"
    | "in"
    | "not_in"
    | "gt"
    | "gte"
    | "lt"
    | "lte";

  type FilterBuilderAttribute = {
    key: string;
    label: string;
    source: string;
    type: string;
    availableOperators: readonly FilterBuilderOperator[];
  };

  type FilterBuilderFilter = {
    attribute: string;
    operator: FilterBuilderOperator;
    value: string;
  };

  const filterBuilderMultiValueDelimiter = "|";

  type FilterBuilderValueSuggestionsLoader = (input: {
    attribute: string;
    operator: FilterBuilderOperator;
    query: string;
    limit: number;
  }) => Promise<{
    success: boolean;
    data?: {
      values: {
        value: string;
        count: number;
      }[];
    };
    error?: string;
  }>;

  const operatorOptions: Record<
    FilterBuilderOperator,
    {
      label: string;
      symbol: string;
    }
  > = {
    eq: { label: "equals", symbol: "=" },
    neq: { label: "not equals", symbol: "≠" },
    contains: { label: "contains", symbol: "contains" },
    not_contains: { label: "does not contain", symbol: "not contains" },
    in: { label: "is any of", symbol: "IN" },
    not_in: { label: "is not any of", symbol: "NOT IN" },
    gt: { label: "greater than", symbol: ">" },
    gte: { label: "greater than or equal", symbol: "≥" },
    lt: { label: "less than", symbol: "<" },
    lte: { label: "less than or equal", symbol: "≤" },
  };

  export { filterBuilderMultiValueDelimiter, operatorOptions };
  export type {
    FilterBuilderAttribute,
    FilterBuilderFilter,
    FilterBuilderOperator,
    FilterBuilderValueSuggestionsLoader,
  };
</script>

<script lang="ts">
  import { cn } from "@repo/components";
  import { Button } from "@repo/components/ui/button";
  import { IconCircleX, IconSearch } from "@tabler/icons-svelte";
  import FilterBuilderState from "./filter-builder-state.svelte";

  let {
    attributes = [],
    filters = [],
    subjectLabel = "items",
    class: className,
    loadValueSuggestions,
    onAddFilter,
    onRemoveFilter,
  }: {
    attributes?: FilterBuilderAttribute[];
    filters?: FilterBuilderFilter[];
    subjectLabel?: string;
    class?: string;
    loadValueSuggestions: FilterBuilderValueSuggestionsLoader;
    onAddFilter: (filter: FilterBuilderFilter) => void;
    onRemoveFilter: (filter: FilterBuilderFilter) => void;
  } = $props();

  const filterBuilderState = new FilterBuilderState(
    attributes,
    () => filters,
    onAddFilter,
    onRemoveFilter,
    loadValueSuggestions,
  );

  const openPopover = () => {
    filterBuilderState.isPopoverOpen = true;
  };

  const focusBuilderInput = (event?: MouseEvent) => {
    if (event?.target instanceof HTMLButtonElement) return;
    filterBuilderState.inputElement?.focus();
    filterBuilderState.isPopoverOpen = true;
  };
</script>

<div class={cn("relative", className)} role="presentation">
  <div
    class={cn(
      "z-10 flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md border border-border bg-background pr-4 pl-8 transition-colors",
      filterBuilderState.isPopoverOpen
        ? "rounded-b-none border-foreground/15"
        : "border-border",
    )}
    onclick={focusBuilderInput}
  >
    <IconSearch
      class="absolute top-2 left-3 size-4 text-muted-foreground opacity-80"
    />
    {#if filterBuilderState.draft || filters.length > 0}
      <Button
        class="absolute top-1 right-1 size-6 opacity-80"
        size="icon-sm"
        variant="ghost"
        onclick={() => {
          filters.forEach(onRemoveFilter);
          filterBuilderState.resetBuilder();
        }}
      >
        <IconCircleX />
      </Button>
    {/if}
    {#each filters as filter}
      <div
        class="inline-flex h-6 items-center gap-1 rounded-md border bg-secondary px-2 text-sm"
      >
        <span class="text-muted-foreground">{filter.attribute}</span>
        <span class="text-muted-foreground">
          {operatorOptions[filter.operator].symbol}
        </span>
        <span class="text-primary">
          {#if filter.operator === "in" || filter.operator === "not_in"}
            {#each filter.value
              .split(filterBuilderMultiValueDelimiter)
              .map((value) => value.trim())
              .filter(Boolean) as value, index}
              {#if index > 0}
                <span class="px-1 text-muted-foreground">
                  {filterBuilderMultiValueDelimiter}
                </span>
              {/if}
              {attributes.find(
                (attribute) => attribute.key === filter.attribute,
              )?.type === "string"
                ? `"${value}"`
                : value}
            {/each}
          {:else}
            {attributes.find((attribute) => attribute.key === filter.attribute)
              ?.type === "string"
              ? `"${filter.value}"`
              : filter.value}
          {/if}
        </span>
      </div>
    {/each}

    <span
      class="inline-flex h-5 items-center gap-1 text-sm text-muted-foreground"
    >
      <span>
        {#if filterBuilderState.builder.attribute}
          {filterBuilderState.builder.attribute.label}
        {/if}
      </span>
      <span>
        {#if filterBuilderState.builder.operator}
          {operatorOptions[filterBuilderState.builder.operator].symbol}
        {/if}
      </span>
      {#if filterBuilderState.builder.values.length > 0}
        <span class="inline-flex items-center gap-1">
          {#each filterBuilderState.builder.values as value, index}
            {#if index > 0}
              <span class="text-muted-foreground">
                {filterBuilderMultiValueDelimiter}
              </span>
            {/if}
            <span class="text-foreground">
              {filterBuilderState.builder.attribute?.type === "string"
                ? `"${value}"`
                : value}
            </span>
          {/each}
        </span>
      {/if}
    </span>

    <input
      bind:this={filterBuilderState.inputElement}
      bind:value={filterBuilderState.draft}
      class="min-w-40 flex-1 bg-transparent px-0 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      placeholder={filterBuilderState.draft ||
      filters.length > 0 ||
      filterBuilderState.builder.stage != "select_attribute"
        ? ""
        : `Filter and search ${subjectLabel}`}
      onfocus={() => {
        openPopover();
      }}
      oninput={() => {
        openPopover();
      }}
      onblur={() => {
        setTimeout(() => {
          filterBuilderState.isPopoverOpen = false;
        }, 120);
      }}
      onkeydown={(event) => {
        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            openPopover();
            filterBuilderState.moveSelection("down");
            return;

          case "ArrowUp":
            event.preventDefault();
            openPopover();
            filterBuilderState.moveSelection("up");
            return;

          case "Enter":
            event.preventDefault();
            filterBuilderState.confirmSelection();
            return;

          case "Backspace":
            if (!filterBuilderState.draft) {
              event.preventDefault();
              filterBuilderState.stepBack();
            }
            return;

          case "Escape":
            event.preventDefault();
            filterBuilderState.resetBuilder();
            filterBuilderState.isPopoverOpen = false;
            return;
        }
      }}
    />
  </div>

  {#if filterBuilderState.isPopoverOpen}
    <div
      class="absolute top-full right-0 left-0 z-10 overflow-hidden rounded-b-md border border-t-0 border-foreground/15 bg-popover"
    >
      {#if filterBuilderState.valueLoading}
        <div
          class="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground"
        >
          <span
            class="size-3 animate-spin rounded-full border border-muted-foreground/30 border-t-foreground"
          ></span>
          Loading values
        </div>
      {:else if filterBuilderState.expectsTypedValue}
        <div class="px-3 py-3 text-sm text-muted-foreground">
          Type a value and press Enter.
        </div>
      {:else if filterBuilderState.suggestions.length === 0}
        <div class="px-3 py-3 text-sm text-muted-foreground">
          {#if filterBuilderState.expectsMultiValue && filterBuilderState.builder.values.length > 0 && !filterBuilderState.draft.trim()}
            Add another value, or press Enter to apply.
          {:else if filterBuilderState.expectsMultiValue}
            Pick values and press Enter when you are done.
          {:else if filterBuilderState.builder.stage === "select_value" && filterBuilderState.draft.trim()}
            Press Enter to use "{filterBuilderState.draft.trim()}".
          {:else}
            No suggestions.
          {/if}
        </div>
      {:else}
        <div class="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {#each filterBuilderState.suggestions as suggestion, index}
            <button
              type="button"
              class={cn(
                "flex w-full items-start justify-between gap-1 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/60",
                index === filterBuilderState.selectedIndex && "bg-muted",
              )}
              onmousedown={(event) => event.preventDefault()}
              onmouseenter={() => {
                filterBuilderState.selectedIndex = index;
              }}
              onclick={() => {
                filterBuilderState.selectedIndex = index;
                filterBuilderState.applySelectedSuggestion();
              }}
            >
              <span class="block min-w-0 truncate text-foreground">
                {suggestion.title}
              </span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
