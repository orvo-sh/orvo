<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import PythonAsset from './python.svg';

  let {
    class: className,
    alt = 'Python',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={PythonAsset} {alt} class={cn('h-6 w-6', className)} {...restProps} />
