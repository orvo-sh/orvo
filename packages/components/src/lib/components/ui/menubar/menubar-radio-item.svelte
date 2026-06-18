<script lang="ts">
  import { Menubar as MenubarPrimitive } from 'bits-ui';
  import { cn, type WithoutChild } from '../../../utils.js';
  import { IconCheck as CheckIcon } from '@tabler/icons-svelte';

  let {
    ref = $bindable(null),
    class: className,
    inset,
    children: childrenProp,
    ...restProps
  }: WithoutChild<MenubarPrimitive.RadioItemProps> & {
    inset?: boolean;
  } = $props();
</script>

<MenubarPrimitive.RadioItem
  bind:ref
  data-slot="menubar-radio-item"
  data-inset={inset}
  class={cn(
    "focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-1.5 pl-7 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-inset:pl-7 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    className
  )}
  {...restProps}
>
  {#snippet children({ checked })}
    <span
      class="pointer-events-none absolute left-1.5 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4"
    >
      {#if checked}
        <CheckIcon />
      {/if}
    </span>
    {@render childrenProp?.({ checked })}
  {/snippet}
</MenubarPrimitive.RadioItem>
