<script lang="ts">
  import { Toaster } from "@repo/components/ui/sonner";
  import { ModeWatcher } from "mode-watcher";
  import "../app.css";
  import type { LayoutData } from "./$types";

  let {
    children,
    data,
  }: {
    children: import("svelte").Snippet;
    data: LayoutData;
  } = $props();
</script>

<ModeWatcher
  defaultMode={data.themeMode}
  track={false}
  disableHeadScriptInjection
/>
<Toaster />
{@render children()}
