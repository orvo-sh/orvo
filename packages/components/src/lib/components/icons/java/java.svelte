<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import JavaAsset from './java.svg';

  let {
    class: className,
    alt = 'Java',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={JavaAsset} {alt} class={cn('h-6 w-6', className)} {...restProps} />
