<script lang="ts">
  import { Select as SelectPrimitive } from 'bits-ui';
  import { cn, type WithoutChildrenOrChild } from '../../../utils.js';
  import { IconChevronUp as CaretUpIcon } from '@tabler/icons-svelte';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: WithoutChildrenOrChild<SelectPrimitive.ScrollUpButtonProps> = $props();
</script>

<SelectPrimitive.ScrollUpButton
  bind:ref
  data-slot="select-scroll-up-button"
  class={cn(
    "bg-popover text-muted-foreground z-10 flex h-7 w-full cursor-default items-center justify-center [&_svg:not([class*='size-'])]:size-4",
    className
  )}
  {...restProps}
>
  <CaretUpIcon />
</SelectPrimitive.ScrollUpButton>
