<script lang="ts">
	import * as Button from '@repo/components/ui/button';
</script>

<main class="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-6 px-6">
	<div class="space-y-3">
		<p class="text-sm uppercase tracking-[0.3em] text-muted-foreground">Orvo</p>
		<h1 class="text-4xl font-semibold tracking-tight">Workspace app scaffolded with shared components</h1>
		<p class="max-w-2xl text-base text-muted-foreground">
			The app now consumes the shared shadcn preset package and routes database work through
			workspace packages.
		</p>
	</div>

	<div class="flex gap-3">
		<Button.Root href="/demo/better-auth">Open Better Auth Demo</Button.Root>
		<Button.Root variant="outline">Shared Button Export Works</Button.Root>
	</div>
</main>
