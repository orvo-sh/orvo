<script lang="ts">
  import { type Snippet } from 'svelte';

  import '../app.css';
  import Footer from './_components/footer.svelte';
  import Header from './_components/header.svelte';

  let { children }: { children: Snippet } = $props();
</script>

<Header />
{@render children()}
<Footer />
