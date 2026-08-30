<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import OpenCodeAsset from './opencode.svg';

  let {
    class: className,
    alt = 'OpenCode',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={OpenCodeAsset} {alt} class={cn('h-6 w-6', className)} {...restProps} />
