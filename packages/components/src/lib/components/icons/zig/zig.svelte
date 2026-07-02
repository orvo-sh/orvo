<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import ZigAsset from './zig.svg';

  let {
    class: className,
    alt = 'Zig',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={ZigAsset} {alt} class={cn('h-6 w-6', className)} {...restProps} />
