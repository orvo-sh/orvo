<script lang="ts">
  import { type Snippet } from 'svelte';

  import '../app.css';
  import Header from './_components/header.svelte';

  let { children }: { children: Snippet } = $props();
</script>

<Header />
{@render children()}
