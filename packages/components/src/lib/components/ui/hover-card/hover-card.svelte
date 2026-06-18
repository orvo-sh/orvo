<script lang="ts">
  import { LinkPreview as HoverCardPrimitive } from 'bits-ui';

  let {
    open = $bindable(false),
    openDelay = 100,
    closeDelay = 100,
    ...restProps
  }: HoverCardPrimitive.RootProps = $props();
</script>

<HoverCardPrimitive.Root bind:open {openDelay} {closeDelay} {...restProps} />
