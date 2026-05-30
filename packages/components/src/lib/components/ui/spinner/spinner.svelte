<script lang="ts">
  import { IconLoader2 as SpinnerIcon } from "@tabler/icons-svelte";
  import type { SVGAttributes } from 'svelte/elements';
  import { cn } from '../../../utils.js';

  let {
    class: className,
    role = 'status',
    // we add name, color, and stroke for compatibility with different icon libraries props
    name,
    color,
    stroke,
    'aria-label': ariaLabel = 'Loading',
    ...restProps
  }: SVGAttributes<SVGSVGElement> = $props();
</script>

<SpinnerIcon
  {role}
  name={name === null ? undefined : name}
  color={color === null ? undefined : color}
  stroke={stroke === null ? undefined : stroke}
  aria-label={ariaLabel}
  class={cn('size-4 animate-spin animation-duration-1000', className)}
  {...restProps}
/>
