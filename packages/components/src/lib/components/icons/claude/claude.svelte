<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import ClaudeAsset from './claude.svg';

  let {
    class: className,
    alt = 'Claude',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={ClaudeAsset} {alt} class={cn('h-6 w-6', className)} {...restProps} />
