<script lang="ts">
  import { Select as SelectPrimitive } from 'bits-ui';
  import { cn, type WithoutChildrenOrChild } from '../../../utils.js';
  import { IconChevronDown as CaretDownIcon } from '@tabler/icons-svelte';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: WithoutChildrenOrChild<SelectPrimitive.ScrollDownButtonProps> = $props();
</script>

<SelectPrimitive.ScrollDownButton
  bind:ref
  data-slot="select-scroll-down-button"
  class={cn(
    "bg-popover text-muted-foreground z-10 flex h-7 w-full cursor-default items-center justify-center [&_svg:not([class*='size-'])]:size-4",
    className
  )}
  {...restProps}
>
  <CaretDownIcon />
</SelectPrimitive.ScrollDownButton>
