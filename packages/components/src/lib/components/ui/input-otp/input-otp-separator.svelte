<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import type { WithElementRef } from '../../../utils.js';
  import { cn } from '../../../utils.js';
  import { IconMinus as MinusIcon } from '@tabler/icons-svelte';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
  bind:this={ref}
  data-slot="input-otp-separator"
  role="separator"
  class={cn("flex items-center [&_svg:not([class*='size-'])]:size-4", className)}
  {...restProps}
>
  {#if children}
    {@render children?.()}
  {:else}
    <MinusIcon />
  {/if}
</div>
