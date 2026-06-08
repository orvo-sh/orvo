<script lang="ts">
	import { page } from '$app/state';
	import { Badge } from '@repo/components/ui/badge';
	import { Button } from '@repo/components/ui/button';
	import { Input } from '@repo/components/ui/input';
	import {
	    IconBrandGithub,
	    IconChevronRight,
	    IconClock,
	    IconExternalLink,
	    IconGitBranch,
	    IconRocket,
	    IconSearch,
	    IconUser
	} from '@tabler/icons-svelte';
	import PageContainer from '../../../_components/page-container/page-container.svelte';

	let { data } = $props();

	type DeploymentStatus = 'pending' | 'in_progress' | 'succeeded' | 'failed' | 'rolled_back';

	type Deployment = {
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

	let error = $state('');
	let deployments = $state<Deployment[]>([]);
	let search = $state('');
	let statusFilter = $state<'all' | DeploymentStatus>('all');
	let environmentFilter = $state('all');

	$effect(() => {
		error = data.deploymentsResult.success ? '' : data.deploymentsResult.error;
		deployments = data.deploymentsResult.success ? data.deploymentsResult.data.deployments : [];
	});

	const environments = $derived([
		'all',
		...Array.from(new Set(deployments.map((deployment) => deployment.environmentName))).sort()
	]);

	const filteredDeployments = $derived.by(() => {
		const query = search.trim().toLowerCase();

		return deployments.filter((deployment) => {
			const matchesSearch =
				!query ||
				[
					deployment.serviceName,
					deployment.environmentName,
					deployment.version,
					deployment.gitSha,
					deployment.gitBranch,
					deployment.gitRepository,
					deployment.gitActor,
					deployment.commitMessage
				]
					.filter(Boolean)
					.some((value) => value!.toLowerCase().includes(query));
			const matchesStatus = statusFilter === 'all' || deployment.status === statusFilter;
			const matchesEnvironment =
				environmentFilter === 'all' || deployment.environmentName === environmentFilter;

			return matchesSearch && matchesStatus && matchesEnvironment;
		});
	});

	const stats = $derived({
		total: deployments.length,
		succeeded: deployments.filter((deployment) => deployment.status === 'succeeded').length,
		failed: deployments.filter((deployment) => deployment.status === 'failed').length,
		services: new Set(deployments.map((deployment) => deployment.serviceName)).size
	});

	const latestDeployment = $derived(deployments[0] ?? null);

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

	const shortSha = (sha: string | null) => sha?.slice(0, 7) ?? 'No SHA';

	const formatDate = (value: Date | string | null) => {
		if (!value) return 'Not set';
		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
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
</script>

<PageContainer title="Deployments">
	{#snippet actions()}
		<Button href={`/a/${page.params.app_id}/settings/ingest-keys`} variant="outline">
			<IconRocket data-slot="button-icon" />
			Setup API
		</Button>
	{/snippet}

	<div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
		{#if error}
			<div
				class="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
			>
				{error}
			</div>
		{/if}

		{#if deployments.length === 0}
			<div
				class="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-background px-4 py-16 text-center"
			>
				<div class="rounded-xl border bg-muted/40 p-3">
					<IconRocket class="size-6 text-muted-foreground" />
				</div>
				<div class="space-y-1">
					<p class="text-sm font-medium">No deployments yet</p>
					<p class="max-w-sm text-sm text-muted-foreground">
						Send a deployment event from CI with your private ingestion key to start tracking release
						health.
					</p>
				</div>
				<div class="rounded-lg border bg-muted/30 px-3 py-2 text-left font-mono text-xs text-muted-foreground">
					curl -X POST /api/deployments -H "Authorization: Bearer sk_..."
				</div>
			</div>
		{:else}
			<section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<div class="rounded-xl border bg-background px-4 py-3">
					<p class="text-2xl font-semibold tabular-nums">{stats.total}</p>
					<p class="mt-0.5 text-xs text-muted-foreground">Total deployments</p>
				</div>
				<div class="rounded-xl border bg-background px-4 py-3">
					<p class="text-2xl font-semibold tabular-nums text-green-600 dark:text-green-400">
						{stats.succeeded}
					</p>
					<p class="mt-0.5 text-xs text-muted-foreground">Succeeded</p>
				</div>
				<div class="rounded-xl border bg-background px-4 py-3">
					<p class="text-2xl font-semibold tabular-nums text-destructive">{stats.failed}</p>
					<p class="mt-0.5 text-xs text-muted-foreground">Failed</p>
				</div>
				<div class="rounded-xl border bg-background px-4 py-3">
					<p class="truncate text-sm font-medium">
						{latestDeployment?.serviceName ?? 'No service'}
					</p>
					<p class="mt-1 text-xs text-muted-foreground">
						Latest release · {stats.services} {stats.services === 1 ? 'service' : 'services'}
					</p>
				</div>
			</section>

			<section class="rounded-xl border bg-background">
				<div class="flex flex-col gap-3 border-b border-border/70 p-3 md:flex-row md:items-center">
					<div class="relative min-w-0 flex-1">
						<IconSearch
							class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<Input bind:value={search} class="pl-9" placeholder="Search deployments..." />
					</div>
					<div class="flex flex-wrap gap-2">
						<select
							bind:value={environmentFilter}
							class="h-9 rounded-md border bg-background px-3 text-sm"
						>
							{#each environments as environment}
								<option value={environment}>{environment === 'all' ? 'All environments' : environment}</option>
							{/each}
						</select>
						<select bind:value={statusFilter} class="h-9 rounded-md border bg-background px-3 text-sm">
							<option value="all">All statuses</option>
							<option value="pending">Pending</option>
							<option value="in_progress">In progress</option>
							<option value="succeeded">Succeeded</option>
							<option value="failed">Failed</option>
							<option value="rolled_back">Rolled back</option>
						</select>
					</div>
				</div>

				<div class="divide-y">
					{#each filteredDeployments as deployment (deployment.id)}
						<a
							href={`/a/${page.params.app_id}/deployments/${deployment.id}`}
							class="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/40 lg:grid-cols-[minmax(180px,1fr)_minmax(140px,0.7fr)_minmax(180px,1fr)_minmax(150px,0.7fr)_24px] lg:items-center"
						>
							<div class="min-w-0">
								<div class="flex min-w-0 items-center gap-2">
									<Badge variant="outline" class={statusClasses[deployment.status]}>
										{statusLabels[deployment.status]}
									</Badge>
									<p class="truncate text-sm font-medium">{deployment.serviceName}</p>
								</div>
								<p class="mt-1 truncate text-xs text-muted-foreground">
									{deployment.environmentName} · {deployment.version ?? 'No version'}
								</p>
							</div>

							<div class="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
								<IconClock class="size-4 shrink-0" />
								<span class="truncate">{formatDate(deployment.startedAt)}</span>
							</div>

							<div class="min-w-0 text-sm">
								<div class="flex min-w-0 items-center gap-2">
									<IconBrandGithub class="size-4 shrink-0 text-muted-foreground" />
									<span class="truncate font-mono text-xs">{shortSha(deployment.gitSha)}</span>
									{#if deployment.gitBranch}
										<span class="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
											<IconGitBranch class="size-3.5 shrink-0" />
											<span class="truncate">{deployment.gitBranch}</span>
										</span>
									{/if}
								</div>
								<p class="mt-1 truncate text-xs text-muted-foreground">
									{deployment.commitMessage ?? deployment.gitRepository ?? 'No commit metadata'}
								</p>
							</div>

							<div class="flex min-w-0 items-center justify-between gap-2 text-sm text-muted-foreground">
								<span class="inline-flex min-w-0 items-center gap-1">
									<IconUser class="size-4 shrink-0" />
									<span class="truncate">{deployment.gitActor ?? 'Unknown actor'}</span>
								</span>
								<span class="shrink-0 text-xs">{formatDuration(deployment.startedAt, deployment.finishedAt)}</span>
								{#if deployment.externalUrl}
									<IconExternalLink class="size-4 shrink-0" />
								{/if}
							</div>

							<IconChevronRight class="hidden size-4 text-muted-foreground lg:block" />
						</a>
					{:else}
						<div class="px-4 py-12 text-center text-sm text-muted-foreground">
							No deployments match these filters.
						</div>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</PageContainer>
