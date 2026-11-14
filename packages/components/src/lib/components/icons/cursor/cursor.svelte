<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import CursorAsset from './cursor.svg';
  import CursorDarkAsset from './cursor-dark.svg';

  let {
    class: className,
    alt = 'Cursor',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={CursorAsset} {alt} class={cn('h-6 w-6 dark:hidden', className)} {...restProps} />

<img
  src={CursorDarkAsset}
  {alt}
  class={cn('hidden h-6 w-6 dark:block', className)}
  {...restProps}
/>
