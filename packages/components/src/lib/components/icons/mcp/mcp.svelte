<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import McpAsset from './mcp.svg';

  let {
    class: className,
    alt = 'Model Context Protocol',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={McpAsset} {alt} class={cn('h-6 w-6 dark:invert', className)} {...restProps} />
