<script lang="ts">
  import { cn } from "@repo/components";
  import { Button } from "@repo/components/ui/button";
  import { Spinner } from "@repo/components/ui/spinner";
  import { IconCheck, IconSearch, IconX } from "@tabler/icons-svelte";
  import { tick, onMount } from "svelte";

  let {
    label,
    placeholder = "Search values...",
    values = $bindable([]),
    multiple = true,
    disabled = false,
    focusOnMount = false,
    sourceKey,
    loadOptions,
    onSelect,
    emptyMessage = "No matching values found in this app.",
  }: {
    label: string;
    placeholder?: string;
    values?: string[];
    multiple?: boolean;
    disabled?: boolean;
    focusOnMount?: boolean;
    sourceKey: string;
    loadOptions: (query: string) => Promise<
      | {
          success: true;
          data: {
            values: {
              value: string;
              unit?: string;
              type?: string;
              isMonotonic?: boolean;
            }[];
          };
        }
      | { success: false; error: string }
    >;
    onSelect?: (option: {
      value: string;
      unit?: string;
      type?: string;
      isMonotonic?: boolean;
    }) => void;
    emptyMessage?: string;
  } = $props();

  const id = $props.id();
  let root: HTMLDivElement;
  let input: HTMLInputElement;
  onMount(() => {
    if (focusOnMount) input?.focus();
  });
  let open = $state(false);
  let search = $state("");
  let loading = $state(false);
  let error = $state("");
  let options = $state<
    { value: string; unit?: string; type?: string; isMonotonic?: boolean }[]
  >([]);
  let selectedIndex = $state(0);
  let retry = $state(0);
  const choices = $derived(
    [
      ...(multiple
        ? values
            .filter(
              (value) => !options.some((option) => option.value === value),
            )
            .map((value) => ({
              value,
              unit: undefined,
              type: undefined,
              isMonotonic: undefined,
            }))
        : []),
      ...options,
    ].filter((option) =>
      option.value.toLowerCase().includes(search.toLowerCase()),
    ),
  );

  $effect(() => {
    void sourceKey;
    void retry;
    const query = search;
    const loader = loadOptions;
    if (!open || disabled) return;
    let cancelled = false;
    loading = true;
    options = [];
    error = "";
    selectedIndex = 0;
    const timer = setTimeout(async () => {
      try {
        const result = await loader(query);
        if (cancelled) return;
        if (!result.success) {
          error = result.error;
          return;
        }
        options = result.data.values;
      } catch {
        if (!cancelled) error = "Failed to load available values.";
      } finally {
        if (!cancelled) loading = false;
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  const choose = (option: {
    value: string;
    unit?: string;
    type?: string;
    isMonotonic?: boolean;
  }) => {
    if (multiple) {
      if (values.includes(option.value)) {
        values = values.filter((value) => value !== option.value);
      } else {
        if (values.length >= 50) return;
        values = [...values, option.value];
      }
    } else {
      onSelect?.(option);
      open = false;
    }
    search = "";
    input?.focus();
  };

  const moveSelection = async (direction: number) => {
    if (!choices.length) return;
    selectedIndex =
      (selectedIndex + direction + choices.length) % choices.length;
    await tick();
    root
      ?.querySelector('[data-highlighted="true"]')
      ?.scrollIntoView({ block: "nearest" });
  };
</script>

<div
  bind:this={root}
  class="relative min-w-0"
  onfocusout={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      open = false;
      search = "";
    }
  }}
>
  <div
    class={cn(
      "relative z-10 flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md border border-border bg-background pr-2 pl-8 transition-colors focus-within:border-ring/50",
      open && !disabled && "rounded-b-none border-foreground/15",
      disabled && "cursor-not-allowed opacity-50",
    )}
  >
    <IconSearch
      class="pointer-events-none absolute top-2 left-3 size-4 text-muted-foreground opacity-80"
    />
    {#if multiple}
      {#each values as value (value)}
        <span
          class="my-0.5 inline-flex max-w-full items-center gap-1 rounded-md border bg-secondary py-0.5 pr-0.5 pl-2 text-sm"
        >
          <span class="min-w-0 truncate">{value}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            class="size-4 shrink-0"
            {disabled}
            aria-label={`Remove ${value} from ${label.toLowerCase()}`}
            onclick={() => {
              values = values.filter((selected) => selected !== value);
              input?.focus();
            }}><IconX class="size-3" /></Button
          >
        </span>
      {/each}
    {/if}
    <input
      bind:this={input}
      {disabled}
      value={!multiple && !open ? (values[0] ?? "") : search}
      class="min-w-20 flex-1 bg-transparent py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      {placeholder}
      aria-label={label}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open && !disabled}
      aria-controls={`${id}-suggestions`}
      aria-activedescendant={open && choices[selectedIndex]
        ? `${id}-option-${selectedIndex}`
        : undefined}
      onfocus={() => {
        open = true;
      }}
      onclick={() => {
        open = true;
      }}
      oninput={(event) => {
        search = event.currentTarget.value;
        open = true;
      }}
      onkeydown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!open) {
            open = true;
            return;
          }
          void moveSelection(event.key === "ArrowDown" ? 1 : -1);
        } else if (event.key === "Enter") {
          event.preventDefault();
          if (open && choices[selectedIndex]) choose(choices[selectedIndex]);
          else open = true;
        } else if (event.key === "Escape") {
          event.preventDefault();
          open = false;
          search = "";
        }
      }}
    />
  </div>
  {#if open && !disabled}
    <div
      class="absolute top-full right-0 left-0 z-20 overflow-hidden rounded-b-md border border-t-0 border-foreground/15 bg-popover"
    >
      {#if loading}
        <div
          role="status"
          class="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground"
        >
          <Spinner class="size-3" /> Loading values
        </div>
      {/if}
      {#if error}
        <div role="alert" class="space-y-2 px-3 py-3 text-sm">
          <p class="text-destructive">{error}</p>
          <Button variant="outline" size="sm" onclick={() => retry++}
            >Try again</Button
          >
        </div>
      {/if}
      <div
        id={`${id}-suggestions`}
        role="listbox"
        aria-label={label}
        aria-multiselectable={multiple}
        class="flex max-h-64 flex-col gap-1 overflow-y-auto"
      >
        {#each choices as option, index (option.value)}
          <button
            id={`${id}-option-${index}`}
            type="button"
            role="option"
            tabindex={-1}
            aria-selected={values.includes(option.value)}
            data-highlighted={index === selectedIndex}
            class={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/60",
              index === selectedIndex && "bg-muted",
            )}
            disabled={multiple &&
              !values.includes(option.value) &&
              values.length >= 50}
            onmousedown={(event) => event.preventDefault()}
            onmouseenter={() => {
              selectedIndex = index;
            }}
            onclick={() => choose(option)}
          >
            <span class="min-w-0 flex-1 break-all">{option.value}</span>
            {#if option.unit && option.unit !== "1"}<span
                class="shrink-0 text-xs text-muted-foreground"
                >{option.unit.replace(/[{}]/g, "")}</span
              >{/if}
            {#if values.includes(option.value)}<IconCheck
                class="size-3.5 shrink-0"
              />{/if}
          </button>
        {/each}
      </div>
      {#if !loading && !error && choices.length === 0}
        <p class="px-3 py-3 text-sm text-muted-foreground">{emptyMessage}</p>
      {/if}
    </div>
  {/if}
</div>
