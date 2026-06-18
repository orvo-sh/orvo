<script lang="ts">
  import { Pagination as PaginationPrimitive } from 'bits-ui';
  import { IconChevronLeft as CaretLeftIcon } from '@tabler/icons-svelte';
  import { cn } from '../../../utils.js';
  import { buttonVariants } from '../button/index.js';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: PaginationPrimitive.PrevButtonProps = $props();
</script>

{#snippet Fallback()}
  <CaretLeftIcon class={cn('size-4', className)} />
  <span>Previous</span>
{/snippet}

<PaginationPrimitive.PrevButton
  bind:ref
  aria-label="Go to previous page"
  class={cn(buttonVariants({ variant: 'ghost' }), 'pl-1.5!', className)}
  {...restProps}
>
  {#if children}
    {@render children?.()}
  {:else}
    {@render Fallback()}
  {/if}
</PaginationPrimitive.PrevButton>
