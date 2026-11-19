<script lang="ts">
  import { PinInput as InputOTPPrimitive } from 'bits-ui';
  import { cn } from '../../../utils.js';

  let {
    ref = $bindable(null),
    cell,
    size = 'md',
    class: className,
    ...restProps
  }: InputOTPPrimitive.CellProps & { size?: 'md' | 'lg' } = $props();
</script>

<InputOTPPrimitive.Cell
  {cell}
  bind:ref
  data-slot="input-otp-slot"
  data-size={size}
  class={cn(
    'dark:bg-input/30 border-input data-[active=true]:border-ring data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:ring-destructive/20 dark:data-[active=true]:aria-invalid:ring-destructive/40 aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive relative flex items-center justify-center border-y border-r text-sm transition-all outline-none first:rounded-l-lg first:border-l last:rounded-r-lg data-[active=true]:z-10 data-[active=true]:ring-3',
    size === 'lg' ? 'size-10' : 'size-8',
    className
  )}
  {...restProps}
>
  {cell.char}
  {#if cell.hasFakeCaret}
    <div
      class="cn-input-otp-caret pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div class="animate-caret-blink bg-foreground bg-foreground h-4 w-px duration-1000"></div>
    </div>
  {/if}
</InputOTPPrimitive.Cell>
