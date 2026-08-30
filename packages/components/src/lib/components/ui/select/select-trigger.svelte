<script lang="ts">
  import { IconChevronDown as CaretDownIcon } from '@tabler/icons-svelte';
  import { Select as SelectPrimitive } from 'bits-ui';
  import { cn, type WithoutChild } from '../../../utils.js';

  let {
    ref = $bindable(null),
    class: className,
    children,
    size = 'default',
    ...restProps
  }: WithoutChild<SelectPrimitive.TriggerProps> & {
    size?: 'sm' | 'default';
  } = $props();
</script>

<SelectPrimitive.Trigger
  bind:ref
  data-slot="select-trigger"
  data-size={size}
  class={cn(
    "border-input bg-background data-placeholder:text-muted-foreground focus-visible:ring-ring/40 aria-invalid:ring-destructive/20 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 dark:aria-invalid:border-destructive/50 flex h-8 w-fit items-center justify-between gap-2 rounded-lg border px-2.5 text-sm whitespace-nowrap transition-[color,box-shadow,border-color,background-color] outline-none select-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    className
  )}
  {...restProps}
>
  {@render children?.()}
  <CaretDownIcon class="text-muted-foreground pointer-events-none size-4" />
</SelectPrimitive.Trigger>
