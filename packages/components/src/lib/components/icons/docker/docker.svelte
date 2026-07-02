<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import DockerAsset from './docker.svg';

  let {
    class: className,
    alt = 'Docker',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={DockerAsset} {alt} class={cn('h-6 w-6', className)} {...restProps} />
