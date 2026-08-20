<script lang="ts">
  import { type Snippet } from 'svelte';

  import '../app.css';
  import Footer from './_components/footer.svelte';
  import Header from './_components/header.svelte';

  let { children, data }: { children: Snippet; data: { githubStars: number } } = $props();
</script>

<Header githubStars={data.githubStars} />
{@render children()}
<Footer />
