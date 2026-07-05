<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import ChatgptAsset from './chatgpt.svg';

  let {
    class: className,
    alt = 'ChatGPT',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={ChatgptAsset} {alt} class={cn('h-6 w-6', className)} {...restProps} />
