<script lang="ts">
  import type { HTMLImgAttributes } from 'svelte/elements';
  import type { ClassValue } from 'tailwind-variants';
  import { cn } from '../../../utils.js';
  import AwsAsset from './aws.svg';

  let {
    class: className,
    alt = 'AWS',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={AwsAsset} {alt} class={cn('h-6 w-6 object-contain', className)} {...restProps} />
