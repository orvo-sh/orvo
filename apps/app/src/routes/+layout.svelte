<script lang="ts">
	import { browser } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import {
	    captureBrowserNavigation,
	    initializeBrowserTelemetry
	} from '$lib/observability/orvo-browser';
	import { Toaster } from "@repo/components/ui/sonner";
	import '../app.css';

	let { children } = $props();

	if (browser) {
		initializeBrowserTelemetry();

		afterNavigate(({ to }) => {
			captureBrowserNavigation(to?.url ?? new URL(window.location.href));
		});
	}
</script>

<Toaster/>
<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
