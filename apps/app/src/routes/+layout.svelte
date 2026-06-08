<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from "@repo/components/ui/sonner";
	import '../app.css';

	let { children } = $props();
</script>

<Toaster/>
<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
