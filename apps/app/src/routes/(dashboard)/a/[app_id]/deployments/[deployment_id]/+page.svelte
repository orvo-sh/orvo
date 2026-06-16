<script lang="ts">
	import { page } from '$app/state';
	import { Badge } from '@repo/components/ui/badge';
	import { Button } from '@repo/components/ui/button';
	import {
	    IconArrowLeft,
	    IconArrowNarrowDown,
	    IconArrowNarrowUp,
	    IconBrandGithub,
	    IconClock,
	    IconExternalLink,
	    IconGitBranch,
	    IconRoute,
	    IconTerminal2,
	    IconUser
	} from '@tabler/icons-svelte';
	import PageContainer from '../../_components/page-container/page-container.svelte';

	let { data } = $props();

	type DeploymentStatus = 'pending' | 'in_progress' | 'succeeded' | 'failed' | 'rolled_back';

	type WindowSummary = {
		startAtUtc: string;
		endAtUtc: string;
		logs: {
			total: number;
			errors: number;
		};
		traces: {
			total: number;
			errors: number;
			errorRate: number;
			p95LatencyMs: number;
			throughputPerMinute: number;
		};
	};

	type DeploymentHealth = {
		deployment: {
			id: string;
			serviceName: string;
			environmentName: string;
			version: string | null;
			status: DeploymentStatus;
			startedAt: Date | string;
			finishedAt: Date | string | null;
			gitSha: string | null;
			gitBranch: string | null;
			gitRepository: string | null;
			gitActor: string | null;
			commitMessage: string | null;
			externalUrl: string | null;
		};
		windowMinutes: number;
		before: WindowSummary;
		after: WindowSummary;
		topErrors: Array<{
			body: string;
			count: number;
			lastSeenAt: string;
		}>;
		slowTraces: Array<{
			traceId: string;
			name: string;
			startTime: string;
			durationNs: number;
			errorCount: number;
		}>;
	};

	const result = $derived(data.deploymentHealthResult);
	const health = $derived(result.success ? (result.data as DeploymentHealth) : null);
	const deployment = $derived(health?.deployment ?? null);

	const statusLabels: Record<DeploymentStatus, string> = {
		pending: 'Pending',
		in_progress: 'In progress',
		succeeded: 'Succeeded',
		failed: 'Failed',
		rolled_back: 'Rolled back'
	};

	const statusClasses: Record<DeploymentStatus, string> = {
		pending: 'border-border text-muted-foreground',
		in_progress: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
		succeeded: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300',
		failed: 'border-destructive/30 bg-destructive/10 text-destructive',
		rolled_back: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
	};

	const afterLogsLink = $derived(
		health
			? `/a/${page.params.app_id}/logs?start=${encodeURIComponent(health.after.startAtUtc)}&end=${encodeURIComponent(health.after.endAtUtc)}&service=${encodeURIComponent(health.deployment.serviceName)}&environment=${encodeURIComponent(health.deployment.environmentName)}`
			: `/a/${page.params.app_id}/logs`
	);

	const tracesLink = $derived(`/a/${page.params.app_id}/traces`);

	const shortSha = (sha: string | null | undefined) => sha?.slice(0, 7) ?? 'No SHA';

	const formatDate = (value: Date | string | null | undefined) => {
		if (!value) return 'Not set';
		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(value));
	};

	const formatDuration = (startedAt: Date | string, finishedAt: Date | string | null) => {
		if (!finishedAt) return 'In progress';
		const durationMs = Math.max(new Date(finishedAt).getTime() - new Date(startedAt).getTime(), 0);
		const minutes = Math.floor(durationMs / 60000);
		const seconds = Math.floor((durationMs % 60000) / 1000);

		if (minutes === 0) return `${seconds}s`;
		return `${minutes}m ${seconds}s`;
	};

	const formatNumber = (value: number) =>
		new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);

	const formatPercent = (value: number) =>
		new Intl.NumberFormat(undefined, {
			style: 'percent',
			maximumFractionDigits: 2
		}).format(value);

	const formatMs = (value: number) => `${formatNumber(value)}ms`;

	const formatTraceDuration = (durationNs: number) => {
		const durationMs = durationNs / 1_000_000;
		if (durationMs < 1000) return `${formatNumber(durationMs)}ms`;
		return `${formatNumber(durationMs / 1000)}s`;
	};

	const delta = (before: number, after: number) => after - before;

	const deltaTone = (value: number, lowerIsBetter = true) => {
		if (Math.abs(value) < 0.0001) return 'text-muted-foreground';
		if (lowerIsBetter) return value > 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400';
		return value > 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive';
	};
</script>

<PageContainer title="Deployment health">
	{#snippet actions()}
		<Button href={`/a/${page.params.app_id}/deployments`} variant="outline">
			<IconArrowLeft data-slot="button-icon" />
			Deployments
		</Button>
		{#if deployment?.externalUrl}
			<Button href={deployment.externalUrl} variant="outline" target="_blank">
				<IconExternalLink data-slot="button-icon" />
				Open deploy
			</Button>
		{/if}
	{/snippet}

	<div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
		{#if result.success === false}
			<div
				class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
			>
				{result.error}
			</div>
		{:else if health && deployment}
			<section class="rounded-xl border bg-background">
				<div
					class="flex flex-col gap-4 border-b border-border/70 px-4 py-4 md:flex-row md:items-start md:justify-between"
				>
					<div class="min-w-0">
						<div class="flex min-w-0 flex-wrap items-center gap-2">
							<Badge variant="outline" class={statusClasses[deployment.status]}>
								{statusLabels[deployment.status]}
							</Badge>
							<h2 class="truncate text-lg font-semibold">{deployment.serviceName}</h2>
							<span class="text-sm text-muted-foreground">/ {deployment.environmentName}</span>
						</div>
						<p class="mt-1 truncate text-sm text-muted-foreground">
							{deployment.version ?? 'No version'} · started {formatDate(deployment.startedAt)}
						</p>
					</div>

					<div class="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 md:min-w-96">
						<div class="inline-flex min-w-0 items-center gap-2">
							<IconBrandGithub class="size-4 shrink-0" />
							<span class="truncate font-mono text-xs">{shortSha(deployment.gitSha)}</span>
						</div>
						<div class="inline-flex min-w-0 items-center gap-2">
							<IconGitBranch class="size-4 shrink-0" />
							<span class="truncate">{deployment.gitBranch ?? 'No branch'}</span>
						</div>
						<div class="inline-flex min-w-0 items-center gap-2">
							<IconUser class="size-4 shrink-0" />
							<span class="truncate">{deployment.gitActor ?? 'Unknown actor'}</span>
						</div>
						<div class="inline-flex min-w-0 items-center gap-2">
							<IconClock class="size-4 shrink-0" />
							<span class="truncate">
								{formatDuration(deployment.startedAt, deployment.finishedAt)}
							</span>
						</div>
					</div>
				</div>

				{#if deployment.commitMessage || deployment.gitRepository}
					<div class="px-4 py-3 text-sm">
						<p class="truncate font-medium">{deployment.commitMessage ?? 'No commit message'}</p>
						<p class="mt-1 truncate text-xs text-muted-foreground">
							{deployment.gitRepository ?? 'No repository'}
						</p>
					</div>
				{/if}
			</section>

			<section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<div class="rounded-xl border bg-background px-4 py-3">
					<div class="flex items-center justify-between gap-2">
						<p class="text-xs text-muted-foreground">Error logs</p>
						<span
							class={`inline-flex items-center text-xs ${deltaTone(delta(health.before.logs.errors, health.after.logs.errors))}`}
						>
							{#if delta(health.before.logs.errors, health.after.logs.errors) > 0}
								<IconArrowNarrowUp class="size-4" />
							{:else if delta(health.before.logs.errors, health.after.logs.errors) < 0}
								<IconArrowNarrowDown class="size-4" />
							{/if}
							{formatNumber(Math.abs(delta(health.before.logs.errors, health.after.logs.errors)))}
						</span>
					</div>
					<p class="mt-2 text-2xl font-semibold tabular-nums">
						{formatNumber(health.after.logs.errors)}
					</p>
					<p class="mt-1 text-xs text-muted-foreground">
						after deploy · {formatNumber(health.before.logs.errors)} before
					</p>
				</div>

				<div class="rounded-xl border bg-background px-4 py-3">
					<div class="flex items-center justify-between gap-2">
						<p class="text-xs text-muted-foreground">Trace error rate</p>
						<span
							class={`inline-flex items-center text-xs ${deltaTone(delta(health.before.traces.errorRate, health.after.traces.errorRate))}`}
						>
							{#if delta(health.before.traces.errorRate, health.after.traces.errorRate) > 0}
								<IconArrowNarrowUp class="size-4" />
							{:else if delta(health.before.traces.errorRate, health.after.traces.errorRate) < 0}
								<IconArrowNarrowDown class="size-4" />
							{/if}
							{formatPercent(Math.abs(delta(health.before.traces.errorRate, health.after.traces.errorRate)))}
						</span>
					</div>
					<p class="mt-2 text-2xl font-semibold tabular-nums">
						{formatPercent(health.after.traces.errorRate)}
					</p>
					<p class="mt-1 text-xs text-muted-foreground">
						{health.windowMinutes}m after · {formatPercent(health.before.traces.errorRate)} before
					</p>
				</div>

				<div class="rounded-xl border bg-background px-4 py-3">
					<div class="flex items-center justify-between gap-2">
						<p class="text-xs text-muted-foreground">p95 latency</p>
						<span
							class={`inline-flex items-center text-xs ${deltaTone(delta(health.before.traces.p95LatencyMs, health.after.traces.p95LatencyMs))}`}
						>
							{#if delta(health.before.traces.p95LatencyMs, health.after.traces.p95LatencyMs) > 0}
								<IconArrowNarrowUp class="size-4" />
							{:else if delta(health.before.traces.p95LatencyMs, health.after.traces.p95LatencyMs) < 0}
								<IconArrowNarrowDown class="size-4" />
							{/if}
							{formatMs(Math.abs(delta(health.before.traces.p95LatencyMs, health.after.traces.p95LatencyMs)))}
						</span>
					</div>
					<p class="mt-2 text-2xl font-semibold tabular-nums">
						{formatMs(health.after.traces.p95LatencyMs)}
					</p>
					<p class="mt-1 text-xs text-muted-foreground">
						{formatMs(health.before.traces.p95LatencyMs)} before
					</p>
				</div>

				<div class="rounded-xl border bg-background px-4 py-3">
					<div class="flex items-center justify-between gap-2">
						<p class="text-xs text-muted-foreground">Throughput</p>
						<span
							class={`inline-flex items-center text-xs ${deltaTone(delta(health.before.traces.throughputPerMinute, health.after.traces.throughputPerMinute), false)}`}
						>
							{#if delta(health.before.traces.throughputPerMinute, health.after.traces.throughputPerMinute) > 0}
								<IconArrowNarrowUp class="size-4" />
							{:else if delta(health.before.traces.throughputPerMinute, health.after.traces.throughputPerMinute) < 0}
								<IconArrowNarrowDown class="size-4" />
							{/if}
							{formatNumber(
								Math.abs(
									delta(
										health.before.traces.throughputPerMinute,
										health.after.traces.throughputPerMinute
									)
								)
							)}/min
						</span>
					</div>
					<p class="mt-2 text-2xl font-semibold tabular-nums">
						{formatNumber(health.after.traces.throughputPerMinute)}/min
					</p>
					<p class="mt-1 text-xs text-muted-foreground">
						{formatNumber(health.before.traces.throughputPerMinute)}/min before
					</p>
				</div>
			</section>

			<div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)]">
				<section class="rounded-xl border bg-background">
					<div
						class="flex flex-col gap-2 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
					>
						<div>
							<p class="text-sm font-medium">Post-deploy errors</p>
							<p class="mt-0.5 text-xs text-muted-foreground">
								Top error log bodies in the first {health.windowMinutes} minutes after deployment.
							</p>
						</div>
						<Button href={afterLogsLink} variant="outline" size="sm">
							<IconTerminal2 data-slot="button-icon" />
							View logs
						</Button>
					</div>

					<div class="divide-y">
						{#each health.topErrors as errorRow}
							<div class="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_96px_140px] sm:items-center">
								<p class="min-w-0 truncate text-sm">{errorRow.body}</p>
								<p class="text-sm font-medium tabular-nums">{formatNumber(errorRow.count)}</p>
								<p class="text-xs text-muted-foreground">{formatDate(errorRow.lastSeenAt)}</p>
							</div>
						{:else}
							<div class="px-4 py-10 text-center text-sm text-muted-foreground">
								No error logs found after this deployment.
							</div>
						{/each}
					</div>
				</section>

				<section class="rounded-xl border bg-background">
					<div
						class="flex flex-col gap-2 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
					>
						<div>
							<p class="text-sm font-medium">Slow traces</p>
							<p class="mt-0.5 text-xs text-muted-foreground">Slowest traces after deployment.</p>
						</div>
						<Button href={tracesLink} variant="outline" size="sm">
							<IconRoute data-slot="button-icon" />
							View traces
						</Button>
					</div>

					<div class="divide-y">
						{#each health.slowTraces as trace}
							<a
								href={`/a/${page.params.app_id}/traces/${trace.traceId}`}
								class="block px-4 py-3 transition-colors hover:bg-muted/40"
							>
								<div class="flex min-w-0 items-center justify-between gap-3">
									<p class="truncate text-sm font-medium">{trace.name || trace.traceId}</p>
									<Badge variant={trace.errorCount > 0 ? 'destructive' : 'outline'}>
										{formatTraceDuration(trace.durationNs)}
									</Badge>
								</div>
								<p class="mt-1 truncate font-mono text-xs text-muted-foreground">{trace.traceId}</p>
							</a>
						{:else}
							<div class="px-4 py-10 text-center text-sm text-muted-foreground">
								No traces found after this deployment.
							</div>
						{/each}
					</div>
				</section>
			</div>
		{/if}
	</div>
</PageContainer>
