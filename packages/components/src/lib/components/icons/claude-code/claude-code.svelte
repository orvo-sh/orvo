<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import ClaudeCodeAsset from './claude-code.svg';

  let {
    class: className,
    alt = 'Claude Code',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={ClaudeCodeAsset} {alt} class={cn('h-6 w-6', className)} {...restProps} />
