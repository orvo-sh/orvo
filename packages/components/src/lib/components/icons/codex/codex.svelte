<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import CodexAsset from './codex.svg';

  let {
    class: className,
    alt = 'Codex',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={CodexAsset} {alt} class={cn('h-6 w-6', className)} {...restProps} />
