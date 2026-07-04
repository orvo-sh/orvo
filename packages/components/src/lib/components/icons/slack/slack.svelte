<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import SlackAsset from './slack.svg';

  let {
    class: className,
    alt = 'Slack',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={SlackAsset} {alt} class={cn('h-6 w-6', className)} {...restProps} />
