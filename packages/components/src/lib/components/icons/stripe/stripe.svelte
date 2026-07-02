<script lang="ts">
  import { cn } from '../../../utils.js';
  import type { ClassValue } from 'tailwind-variants';
  import type { HTMLImgAttributes } from 'svelte/elements';
  import StripeAsset from './stripe.svg';

  let {
    class: className,
    alt = 'Stripe',
    ...restProps
  }: HTMLImgAttributes & { class: ClassValue | null | undefined } = $props();
</script>

<img src={StripeAsset} {alt} class={cn('h-6 w-6', className)} {...restProps} />
