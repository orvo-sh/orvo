<script lang="ts">
  import { Pagination as PaginationPrimitive } from 'bits-ui';
  import { cn } from '../../../utils.js';
  import { buttonVariants } from '../button/index.js';
  import { IconChevronLeft as CaretLeftIcon } from '@tabler/icons-svelte';

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: PaginationPrimitive.PrevButtonProps = $props();
</script>

<PaginationPrimitive.PrevButton
  bind:ref
  aria-label="Go to previous page"
  class={cn(buttonVariants({ variant: 'ghost', size: 'default' }), 'pl-1.5!', className)}
  {...restProps}
>
  <CaretLeftIcon data-icon="inline-start" />
  <span class="cn-pagination-previous-text hidden sm:block">Previous</span>
</PaginationPrimitive.PrevButton>
