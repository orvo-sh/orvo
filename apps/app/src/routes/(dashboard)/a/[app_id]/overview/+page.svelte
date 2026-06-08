<script lang="ts">
	import { page } from '$app/state';
	import { Badge } from '@repo/components/ui/badge';
	import { Button } from '@repo/components/ui/button';
	import {
	    IconBell,
	    IconBook2,
	    IconChevronRight,
	    IconCircleCheck,
	    IconCopy,
	    IconDots,
	    IconExternalLink,
	    IconGitBranch,
	    IconKey,
	    IconRoute,
	    IconSearch,
	    IconTerminal2
	} from '@tabler/icons-svelte';
	import PageContainer from '../../../_components/page-container/page-container.svelte';

	type DashboardPageData = {
		currentApp?: {
			id: string;
			name: string;
			defaultTimezone: string;
		};
	};

	type FeatureCard = {
		title: string;
		window: string;
		path: string;
		icon: typeof IconTerminal2;
		primary: string;
		secondary: string;
		statRows: Array<{
			label: string;
			value: string;
		}>;
	};

	type ServiceRow = {
		name: string;
		environment: string;
		status: 'healthy' | 'warning';
		logs: string;
		traces: string;
		errorRate: string;
		lastSeen: string;
	};

	const appId = $derived(page.params.app_id);
	const currentApp = $derived((page.data as DashboardPageData).currentApp);
	const appName = $derived(currentApp?.name ?? 'App');
	const timezone = $derived(currentApp?.defaultTimezone ?? 'UTC');
	const deploymentHost = $derived(`${appName.toLowerCase().replaceAll(' ', '-')}.orvo.app`);

	const featureCards: FeatureCard[] = [
		{
			title: 'Logs',
			window: '1h',
			path: 'logs',
			icon: IconTerminal2,
			primary: '42.8k records',
			secondary: 'Structured runtime events and errors.',
			statRows: [
				{ label: 'Errors', value: '128' },
				{ label: 'Services', value: '7' },
				{ label: 'Environments', value: '3' }
			]
		},
		{
			title: 'Traces',
			window: '1h',
			path: 'traces',
			icon: IconRoute,
			primary: '9.1k traces',
			secondary: 'Request paths, spans, and latency.',
			statRows: [
				{ label: 'p95 latency', value: '418ms' },
				{ label: 'Slow traces', value: '16' },
				{ label: 'Error traces', value: '41' }
			]
		},
		{
			title: 'Alerts',
			window: 'now',
			path: 'alerts',
			icon: IconBell,
			primary: '2 active',
			secondary: 'Rules watching health signals.',
			statRows: [
				{ label: 'Firing rules', value: '4' },
				{ label: 'Healthy rules', value: '11' },
				{ label: 'Disabled', value: '1' }
			]
		}
	];

	const services: ServiceRow[] = [
		{
			name: 'api-gateway',
			environment: 'production',
			status: 'warning',
			logs: '18.4k',
			traces: '4.2k',
			errorRate: '1.8%',
			lastSeen: '2m ago'
		},
		{
			name: 'checkout-worker',
			environment: 'production',
			status: 'healthy',
			logs: '9.7k',
			traces: '2.1k',
			errorRate: '0.2%',
			lastSeen: '4m ago'
		},
		{
			name: 'billing-sync',
			environment: 'staging',
			status: 'healthy',
			logs: '3.2k',
			traces: '812',
			errorRate: '0%',
			lastSeen: '8m ago'
		}
	];

	const previewBars = [18, 28, 22, 42, 48, 34, 54, 62, 46, 58, 72, 64, 52, 44, 56, 68];

	const copyEndpoint = async () => {
		await navigator.clipboard.writeText('https://ingest.orvo.sh');
	};
</script>

<PageContainer title="Overview" class="bg-secondary">
	{#snippet actions()}
		<Button href={`/a/${appId}/logs`}>
			<IconTerminal2 data-slot="button-icon" />
			View logs
		</Button>
	{/snippet}

	<div class="mx-auto flex w-full max-w-7xl flex-col gap-5">
		<section class="overflow-hidden rounded-xl border bg-background shadow-sm">
			<div
				class="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
			>
				<div class="min-w-0">
					<p class="text-sm font-medium text-foreground">App health</p>
					<p class="mt-0.5 text-xs text-muted-foreground">
						Production telemetry and setup status for {appName}.
					</p>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<Button href={`/a/${appId}/settings/ingest-keys`} variant="outline" size="sm">
						<IconKey data-slot="button-icon" />
						Ingestion keys
					</Button>
					<Button href={`/a/${appId}/alerts`} variant="outline" size="sm">
						<IconBell data-slot="button-icon" />
						Alerts
					</Button>
				</div>
			</div>

			<div class="grid gap-6 p-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1fr)] lg:p-5">
				<div class="min-h-72 rounded-lg border bg-muted/10 p-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium">Live preview</p>
							<p class="mt-1 text-xs text-muted-foreground">Recent event flow over the last hour.</p>
						</div>
						<Badge variant="outline" class="gap-1 text-xs text-muted-foreground">
							<span class="size-1.5 rounded-full bg-green-500"></span>
							Receiving
						</Badge>
					</div>

					<div class="mt-8 flex h-36 items-end gap-1.5">
						{#each previewBars as value, index}
							<div class="flex min-w-0 flex-1 flex-col items-center gap-1">
								<div
									class="w-full rounded-t-sm bg-primary/70"
									style={`height: ${value}%`}
									aria-label={`Preview bucket ${index + 1}`}
								></div>
								<div class="h-1 w-full rounded-full bg-border"></div>
							</div>
						{/each}
					</div>

					<div class="mt-6 grid gap-3 sm:grid-cols-3">
						<div>
							<p class="text-xs text-muted-foreground">Logs</p>
							<p class="mt-1 text-lg font-semibold tabular-nums">42.8k</p>
						</div>
						<div>
							<p class="text-xs text-muted-foreground">Traces</p>
							<p class="mt-1 text-lg font-semibold tabular-nums">9.1k</p>
						</div>
						<div>
							<p class="text-xs text-muted-foreground">Error rate</p>
							<p class="mt-1 text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-400">
								1.2%
							</p>
						</div>
					</div>
				</div>

				<div class="grid content-start gap-5 py-1">
					<div>
						<p class="text-sm text-muted-foreground">App</p>
						<div class="mt-1 flex flex-wrap items-center gap-2">
							<h2 class="text-xl font-semibold tracking-tight text-foreground">{appName}</h2>
							<Badge
								variant="outline"
								class="gap-1 border-green-500/30 text-xs text-green-600 dark:text-green-400"
							>
								<span class="size-1.5 rounded-full bg-green-500"></span>
								Healthy
							</Badge>
						</div>
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<p class="text-sm text-muted-foreground">Ingestion</p>
							<div class="mt-1 flex items-center gap-2 text-sm font-medium">
								<span class="size-2 rounded-full bg-green-500"></span>
								Receiving data
							</div>
						</div>
						<div>
							<p class="text-sm text-muted-foreground">Last event</p>
							<p class="mt-1 text-sm font-medium">2 minutes ago</p>
						</div>
						<div>
							<p class="text-sm text-muted-foreground">Endpoint</p>
							<div class="mt-1 flex min-w-0 items-center gap-1.5 text-sm font-medium">
								<span class="truncate">{deploymentHost}</span>
								<IconExternalLink class="size-3.5 shrink-0 text-muted-foreground" />
							</div>
						</div>
						<div>
							<p class="text-sm text-muted-foreground">Timezone</p>
							<p class="mt-1 text-sm font-medium">{timezone}</p>
						</div>
					</div>

					<div>
						<p class="text-sm text-muted-foreground">Source</p>
						<div class="mt-2 grid gap-2 text-sm">
							<div class="flex items-center gap-2">
								<IconGitBranch class="size-4 text-muted-foreground" />
								<code class="rounded-md bg-muted px-1.5 py-0.5 text-sm">production</code>
								<span class="text-muted-foreground">private ingestion key</span>
							</div>
							<div class="flex items-center gap-2">
								<IconCircleCheck class="size-4 text-green-600 dark:text-green-400" />
								<code class="rounded-md bg-muted px-1.5 py-0.5 text-sm">otel-node</code>
								<span class="text-muted-foreground">latest sender</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<a
				href={`/a/${appId}/settings/ingest-keys`}
				class="flex items-center justify-between gap-4 border-t border-border/70 px-4 py-3 text-sm transition-colors hover:bg-muted/35"
			>
				<div class="flex min-w-0 items-center gap-3">
					<IconChevronRight class="size-4 shrink-0 text-muted-foreground" />
					<span class="font-medium">Ingestion settings</span>
					<Badge variant="secondary" class="rounded-full px-2 py-0.5 text-xs">
						2 recommendations
					</Badge>
				</div>
				<span class="hidden text-xs text-muted-foreground sm:block">Review SDK and key setup</span>
			</a>
		</section>

		<section
			class="flex flex-col gap-3 rounded-xl border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
		>
			<p class="text-sm text-muted-foreground">
				Send telemetry to Orvo using your private ingestion key.
			</p>
			<div class="flex flex-wrap items-center gap-2">
				<Button variant="outline" size="sm" onclick={copyEndpoint}>
					<IconCopy data-slot="button-icon" />
					Copy endpoint
				</Button>
				<Button href="https://orvo.sh/docs" target="_blank" variant="outline" size="sm">
					<IconBook2 data-slot="button-icon" />
					Docs
				</Button>
			</div>
		</section>

		<section class="grid gap-5 lg:grid-cols-3">
			{#each featureCards as feature (feature.title)}
				{@const FeatureIcon = feature.icon}
				<a
					href={`/a/${appId}/${feature.path}`}
					class="group rounded-xl border bg-background p-4 transition-colors hover:bg-muted/25"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex min-w-0 items-center gap-2">
							<div
								class="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground"
							>
								<FeatureIcon class="size-4" />
							</div>
							<div class="min-w-0">
								<div class="flex items-center gap-2">
									<h3 class="truncate text-sm font-medium">{feature.title}</h3>
									<span class="text-xs text-muted-foreground">{feature.window}</span>
								</div>
								<p class="mt-1 truncate text-xs text-muted-foreground">{feature.secondary}</p>
							</div>
						</div>
						<IconChevronRight
							class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
						/>
					</div>

					<div class="mt-6">
						<p class="text-xl font-semibold tabular-nums">{feature.primary}</p>
					</div>

					<div class="mt-5 grid gap-3">
						{#each feature.statRows as row (row.label)}
							<div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
								<div>
									<p class="text-sm text-muted-foreground">{row.label}</p>
								</div>
								<div class="h-px min-w-20 bg-border"></div>
								<p class="text-sm font-medium tabular-nums">{row.value}</p>
							</div>
						{/each}
					</div>
				</a>
			{/each}
		</section>

		<section class="space-y-3">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<h2 class="text-xl font-semibold tracking-tight">Recent services</h2>
				<div class="flex items-center gap-2">
					<div class="relative min-w-56">
						<IconSearch
							class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<div
							class="flex h-9 items-center rounded-lg border bg-background pl-9 pr-3 text-sm text-muted-foreground"
						>
							Search services...
						</div>
					</div>
					<Button href={`/a/${appId}/logs`} variant="outline" size="sm">
						<IconTerminal2 data-slot="button-icon" />
						Logs
					</Button>
				</div>
			</div>

			<div class="overflow-hidden rounded-xl border bg-background">
				<div
					class="hidden grid-cols-[minmax(220px,1fr)_140px_110px_110px_110px_100px_44px] gap-4 border-b border-border/70 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid"
				>
					<span>Service</span>
					<span>Environment</span>
					<span>Logs</span>
					<span>Traces</span>
					<span>Error rate</span>
					<span>Last seen</span>
					<span></span>
				</div>

				<div class="divide-y divide-border/70">
					{#each services as service (service.name)}
						<div
							class="grid gap-3 px-4 py-3 md:grid-cols-[minmax(220px,1fr)_140px_110px_110px_110px_100px_44px] md:items-center md:gap-4"
						>
							<div class="flex min-w-0 items-center gap-3">
								<span
									class="size-2 shrink-0 rounded-full"
									class:bg-green-500={service.status === 'healthy'}
									class:bg-amber-500={service.status === 'warning'}
								></span>
								<div class="min-w-0">
									<p class="truncate text-sm font-medium">{service.name}</p>
									<p class="text-xs text-muted-foreground md:hidden">
										{service.environment} - {service.lastSeen}
									</p>
								</div>
							</div>
							<div class="hidden md:block">
								<Badge variant="outline" class="text-xs text-muted-foreground">
									{service.environment}
								</Badge>
							</div>
							<p class="text-sm tabular-nums">
								<span class="text-muted-foreground md:hidden">Logs: </span>{service.logs}
							</p>
							<p class="text-sm tabular-nums">
								<span class="text-muted-foreground md:hidden">Traces: </span>{service.traces}
							</p>
							<p
								class="text-sm tabular-nums"
								class:text-amber-600={service.status === 'warning'}
								class:dark:text-amber-400={service.status === 'warning'}
							>
								<span class="text-muted-foreground md:hidden">Error rate: </span>{service.errorRate}
							</p>
							<p class="hidden text-sm text-muted-foreground md:block">{service.lastSeen}</p>
							<div class="hidden justify-end md:flex">
								<Button variant="ghost" size="icon-sm" aria-label={`Open ${service.name} actions`}>
									<IconDots data-slot="button-icon" />
								</Button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</section>
	</div>
</PageContainer>
