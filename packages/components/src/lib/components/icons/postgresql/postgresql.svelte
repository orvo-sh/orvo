<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import PostgresqlAsset from './postgresql.png';

  let {
    class: className,
    alt = 'PostgreSQL',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={PostgresqlAsset} {alt} class={cn('h-6 w-6', className)} {...restProps} />
