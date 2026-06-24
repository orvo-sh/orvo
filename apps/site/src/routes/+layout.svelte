<script lang="ts">
  import '../app.css';
  import Header from './_components/header.svelte';

  let { children }: { children: import('svelte').Snippet } = $props();
</script>

<Header />
{@render children()}
