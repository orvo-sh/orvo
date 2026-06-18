<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import GitHubAsset from './github.svg';

  let {
    class: className,
    alt = 'GitHub',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={GitHubAsset} {alt} class={cn('h-6 w-6', className)} {...restProps} />
