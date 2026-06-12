<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import RustAsset from './rust.svg';

  let {
    class: className,
    alt = 'Rust',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={RustAsset} {alt} class={cn('h-6 w-6', className)} {...restProps} />
