<script lang="ts">
  import { Toaster } from "@repo/components/ui/sonner";
  import "../app.css";

  let { children } = $props();
</script>

<Toaster />
{@render children()}
