<script lang="ts">
  import type { Snippet } from "svelte";

  import {
    useRightRail,
    type RightRailPortalConfig,
  } from "./right-rail.svelte";

  let {
    id,
    open,
    persistOnNavigation = false,
    widthClass = "w-96 min-w-96",
    class: className = "",
    children,
  }: RightRailPortalConfig & {
    children: Snippet;
  } = $props();

  const rightRail = useRightRail();

  $effect(() => {
    if (open) {
      rightRail.mount({
        id,
        persistOnNavigation,
        widthClass,
        class: className,
        children,
      });

      return () => {
        rightRail.unmount(id);
      };
    }

    rightRail.unmount(id);
  });
</script>
