<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Button from '@repo/components/ui/button';
	let { data } = $props();
</script>

<main class="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
	<div class="grid gap-8 rounded-3xl border border-border/70 bg-background/95 p-8 shadow-sm md:grid-cols-[1.3fr_0.9fr]">
		<section class="space-y-5">
			<div class="flex items-center gap-3">
				<div class="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
					O
				</div>
				<div>
					<p class="text-sm uppercase tracking-[0.3em] text-muted-foreground">Orvo</p>
					<h1 class="text-3xl font-semibold tracking-tight">{data.activeOrganization.name}</h1>
				</div>
			</div>
			<p class="max-w-2xl text-base text-muted-foreground">
				You are signed in as {data.user.email}. Your active organization is
				<span class="font-medium text-foreground">{data.activeOrganization.slug}</span>.
			</p>
			<div class="flex flex-wrap gap-3">
				<Button.Root href="/organizations">Switch organization</Button.Root>
				<Button.Root href="/organizations/new" variant="outline">Create another workspace</Button.Root>
			</div>
		</section>

		<aside class="rounded-2xl border border-border/70 bg-muted/30 p-5">
			<p class="text-sm font-medium">Organizations</p>
			<div class="mt-4 space-y-3">
				{#each data.organizations as organization}
					<div class="rounded-xl border border-border/70 bg-background px-4 py-3">
						<div class="flex items-center justify-between gap-3">
							<div>
								<p class="font-medium">{organization.name}</p>
								<p class="text-sm text-muted-foreground">{organization.slug}</p>
							</div>
							{#if organization.id === data.activeOrganization.id}
								<span
									class="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
								>
									Active
								</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
			<form class="mt-4" method="post" use:enhance>
				<Button.Root type="submit" variant="ghost">Sign out</Button.Root>
			</form>
		</aside>
	</div>
</main>
