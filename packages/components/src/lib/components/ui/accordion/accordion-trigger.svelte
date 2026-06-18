<script lang="ts">
  import { IconChevronDown as CaretDownIcon } from '@tabler/icons-svelte';
  import { Accordion as AccordionPrimitive } from 'bits-ui';
  import { cn, type WithoutChild } from '../../../utils.js';

  let {
    ref = $bindable(null),
    class: className,
    level = 3,
    children,
    ...restProps
  }: WithoutChild<AccordionPrimitive.TriggerProps> & {
    level?: AccordionPrimitive.HeaderProps['level'];
  } = $props();
</script>

<AccordionPrimitive.Header {level} class="flex">
  <AccordionPrimitive.Trigger
    data-slot="accordion-trigger"
    bind:ref
    class={cn(
      'focus-visible:ring-ring/40  focus-visible:after:border-ring **:data-[slot=accordion-trigger-icon]:text-muted-foreground group/accordion-trigger relative flex flex-1 items-start justify-between rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4',
      className
    )}
    {...restProps}
  >
    {@render children?.()}
    <div class="bg-muted-foreground/10 flex size-5 items-center justify-center rounded-full">
      <CaretDownIcon class="size-3.5! group-aria-expanded/accordion-trigger:rotate-180" />
    </div>
  </AccordionPrimitive.Trigger>
</AccordionPrimitive.Header>
