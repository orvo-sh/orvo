<script lang="ts">
  import { IconLayoutSidebar as SidebarIcon } from '@tabler/icons-svelte';
  import { Button } from '../button/index.js';
  import { cn } from '../../../utils.js';
  import type { ComponentProps } from 'svelte';
  import { useSidebar } from './context.svelte.js';

  let {
    ref = $bindable(null),
    class: className,
    onclick,
    ...restProps
  }: ComponentProps<typeof Button> & {
    onclick?: (e: MouseEvent) => void;
  } = $props();

  const sidebar = useSidebar();
</script>

<Button
  bind:ref
  data-sidebar="trigger"
  data-slot="sidebar-trigger"
  variant="ghost"
  size="icon-sm"
  class={cn('cn-sidebar-trigger', className)}
  type="button"
  onclick={(e) => {
    onclick?.(e);
    sidebar.toggle();
  }}
  {...restProps}
>
  <SidebarIcon />
  <span class="sr-only">Toggle Sidebar</span>
</Button>
