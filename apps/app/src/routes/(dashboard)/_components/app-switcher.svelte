<script lang="ts">
	import { page } from '$app/state';
	import { buttonVariants } from '@repo/components/ui/button';
	import * as Popover from '@repo/components/ui/popover';
	import { IconPlus, IconSelector as CaretUpDownIcon } from '@tabler/icons-svelte';

	type AppOption = {
		id: string;
		name: string;
	};

	type DashboardPageData = {
		apps?: AppOption[];
		currentApp?: AppOption;
	};

	const getSwitchHref = (nextAppId: string, currentAppId: string, pathname: string) => {
		const prefix = `/a/${currentAppId}`;
		if (!pathname.startsWith(prefix)) {
			return `/a/${nextAppId}`;
		}

		const suffix = pathname.slice(prefix.length);
		if (!suffix) {
			return `/a/${nextAppId}`;
		}

		if (
			suffix === '/logs' ||
			suffix === '/metrics' ||
			suffix === '/traces' ||
			suffix === '/alerts' ||
			suffix === '/alerts/new' ||
			suffix === '/settings' ||
			suffix === '/settings/ingest-keys' ||
			/^\/logs\/[^/]+$/.test(suffix)
		) {
			return `/a/${nextAppId}${suffix}`;
		}

		if (suffix.startsWith('/alerts/')) {
			return `/a/${nextAppId}/alerts`;
		}

		if (suffix.startsWith('/traces/')) {
			return `/a/${nextAppId}/traces`;
		}

		return `/a/${nextAppId}`;
	};

	const dashboardData = $derived((page.data as DashboardPageData | undefined) ?? {});
	const apps = $derived(dashboardData.apps ?? []);
	const currentApp = $derived(dashboardData.currentApp ?? null);
</script>

{#if currentApp && apps.length > 0}
	<Popover.Root>
		<Popover.Trigger class={buttonVariants({ variant: 'outline', class: 'h-8 gap-2 px-2.5 shadow-none' })}>
			<span class="text-xs font-medium text-muted-foreground">App</span>
			<span class="max-w-40 truncate text-sm font-medium text-foreground">{currentApp.name}</span>
			<CaretUpDownIcon class="size-4 text-muted-foreground" />
		</Popover.Trigger>

		<Popover.Content align="start" class="w-72 p-0">
			<Popover.Header class="border-b px-4 py-3">
				<Popover.Title>Switch app</Popover.Title>
				<Popover.Description>Move between telemetry apps in this organization.</Popover.Description>
			</Popover.Header>

			<div class="p-2">
				{#each apps as app}
					<a
						href={getSwitchHref(app.id, currentApp.id, page.url.pathname)}
						class={buttonVariants({
							variant: app.id === currentApp.id ? 'secondary' : 'ghost',
							class: 'h-auto w-full justify-start px-2 py-2'
						})}
					>
						<span class="truncate text-sm font-medium">{app.name}</span>
					</a>
				{/each}
			</div>

			<div class="border-t p-2">
				<a href="/apps/new" class={buttonVariants({ variant: 'ghost', class: 'w-full justify-start px-2' })}>
					<IconPlus data-slot="button-icon" />
					New app
				</a>
			</div>
		</Popover.Content>
	</Popover.Root>
{/if}
