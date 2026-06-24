<script lang="ts">
  import { page } from "$app/state";
  import type { Snippet } from "svelte";

  import { setRightRail } from "./right-rail.svelte";

  let { children }: { children: Snippet } = $props();

  const rightRail = setRightRail(() => page.url.pathname);

  $effect(() => {
    rightRail.handlePathChange(page.url.pathname);
  });
</script>

{@render children()}
