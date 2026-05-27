<script lang="ts">
	import {
		getLogFacetsQuery,
		getLogsQuery,
		getLogVolumeQuery
	} from '$lib/api/logs.remote';
	import { Button, buttonVariants } from '@repo/components/ui/button';
	import { ButtonGroup } from '@repo/components/ui/button-group';
	import * as DropdownMenu from '@repo/components/ui/dropdown-menu';
	import {
	    ArrowsClockwiseIcon,
	    CaretDownIcon,
	    CopyIcon,
	    FloppyDiskIcon,
	    PencilSimpleIcon,
	    PlayIcon,
	    TrashIcon
	} from 'phosphor-svelte';
	import PageContainer from '../../_components/page-container.svelte';
	import LogFilterBar from './_components/log-filter-bar.svelte';
	import LogTable from './_components/log-table.svelte';
	import LogVolumeChart from './_components/log-volume-chart.svelte';
	import type { LogFacets, LogFilters, LogRecord, LogVolumeBucket } from './types';

	let hasView = $state(true);
	let live = $state(false);

	// Default time window: last 10 hours
	let rangeStart = $state(new Date(Date.now() - 10 * 60 * 60 * 1000));
	let rangeEnd = $state(new Date());

	$effect(() => {
		if (!live) return;
		const id = setInterval(() => {
			rangeEnd = new Date();
		}, 5000);
		return () => clearInterval(id);
	});

	let filters = $state<LogFilters>({
		search: '',
		levels: [],
		services: [],
		scopes: [],
		environments: [],
		traceId: ''
	});

	let logs = $state<LogRecord[]>([]);
	let volumeBuckets = $state<LogVolumeBucket[]>([]);
	let loading = $state(false);
	let error = $state('');
	let loadRequest = 0;

	let facets = $state<LogFacets>({
		levels: [],
		services: [],
		environments: [],
		scopes: [],
		ingestionKeyIds: [],
		contentTypes: [],
		contentEncodings: [],
		remoteAddrs: [],
		userAgents: []
	});

	const createBaseLogsInput = () => ({
		time: {
			kind: 'range' as const,
			startAtUtc: rangeStart.toISOString(),
			endAtUtc: rangeEnd.toISOString()
		},
		search: filters.search.trim(),
		levels: filters.levels,
		services: filters.services,
		environments: filters.environments,
		scopes: filters.scopes,
		ingestionKeyIds: [],
		contentTypes: [],
		contentEncodings: [],
		remoteAddrs: [],
		userAgents: [],
		traceId: filters.traceId.trim() || undefined
	});

	const refreshLogs = async () => {
		const requestId = ++loadRequest;
		loading = true;
		error = '';

		const [logsResult, volumeResult, facetsResult] = await Promise.all([
			getLogsQuery({
				...createBaseLogsInput(),
				limit: 250
			}),
			getLogVolumeQuery({
				...createBaseLogsInput(),
				bucketCount: 80
			}),
			getLogFacetsQuery({
				...createBaseLogsInput(),
				maxValuesPerFacet: 50
			})
		]);

		if (requestId !== loadRequest) {
			return;
		}

		if (logsResult.success === false) {
			error = logsResult.error;
			loading = false;
			return;
		}

		if (volumeResult.success === false) {
			error = volumeResult.error;
			loading = false;
			return;
		}

		if (facetsResult.success === false) {
			error = facetsResult.error;
			loading = false;
			return;
		}

		logs = logsResult.data.logs;
		volumeBuckets = volumeResult.data.buckets;
		facets = facetsResult.data;
		loading = false;
	};

	const querySignature = $derived.by(() =>
		JSON.stringify({
			start: rangeStart.toISOString(),
			end: rangeEnd.toISOString(),
			search: filters.search,
			levels: filters.levels,
			services: filters.services,
			scopes: filters.scopes,
			environments: filters.environments,
			traceId: filters.traceId
		})
	);

	const serviceOptions = $derived(
		facets.services.map((service) => ({
			value: service.value,
			label: service.value
		}))
	);

	const environmentOptions = $derived(
		facets.environments.map((environment) => ({
			value: environment.value,
			label: environment.value
		}))
	);

	const scopeOptions = $derived(
		facets.scopes.map((scope) => ({
			value: scope.value,
			label: scope.value
		}))
	);

	const refresh = () => {
		rangeEnd = new Date();
	};

	const onBucketClick = (start: Date, end: Date) => {
		rangeStart = start;
		rangeEnd = end;
	};

	$effect(() => {
		querySignature;

		const timeout = setTimeout(() => {
			void refreshLogs();
		}, 250);

		return () => {
			clearTimeout(timeout);
		};
	});
</script>

<PageContainer title="Logs" class="overflow-hidden">
	{#snippet actions()}
		<!-- Live mode toggle -->
		<Button
			variant="outline"
			onclick={() => { live = !live; if (live) rangeEnd = new Date(); }}
			class={live ? 'border-green-500/50 text-green-600 dark:text-green-400' : ''}
		>
			{#if live}
				<span class="size-2 rounded-full bg-green-500 animate-pulse" data-slot="button-icon"></span>
				Live
			{:else}
				<PlayIcon data-slot="button-icon" />
				Live
			{/if}
		</Button>

		{#if !live}
			<Button variant="outline" onclick={refresh}>
				<ArrowsClockwiseIcon data-slot="button-icon" />
				Refresh
			</Button>
		{/if}

		<ButtonGroup>
			<Button variant="outline">
				<FloppyDiskIcon data-slot="button-icon" />
				Save view
			</Button>
			{#if hasView}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						aria-label="Open saved view actions"
						class={buttonVariants({ variant: 'outline', size: 'icon' })}
					>
						<CaretDownIcon />
					</DropdownMenu.Trigger>

					<DropdownMenu.Content align="end" class="w-52">
						<DropdownMenu.Item variant="destructive">
							<TrashIcon />
							Delete view
						</DropdownMenu.Item>
						<DropdownMenu.Item>
							<PencilSimpleIcon />
							Rename view
						</DropdownMenu.Item>
						<DropdownMenu.Item>
							<CopyIcon />
							Duplicate view
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Item>
							<FloppyDiskIcon />
							Save as new view
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/if}
		</ButtonGroup>
	{/snippet}

	<!-- Override the page-container inner scroll to get a sticky toolbar + full-height table -->
	{#snippet children()}
		<div class="flex flex-col min-h-0 flex-1 -mx-4 -my-4 md:-mx-6 md:-my-5">
			<!-- Filter bar -->
			<LogFilterBar
				bind:start={rangeStart}
				bind:end={rangeEnd}
				bind:filters
				{serviceOptions}
				{environmentOptions}
				{scopeOptions}
			/>

			{#if error}
				<div class="border-b bg-destructive/5 px-4 py-2 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<!-- Volume chart -->
			<div class="px-4 pt-3 pb-1 border-b bg-background shrink-0">
				<LogVolumeChart
					buckets={volumeBuckets}
					start={rangeStart}
					end={rangeEnd}
					{onBucketClick}
				/>
			</div>

			<!-- Log table — fills remaining height -->
			<LogTable {logs} {filters} {loading} />
		</div>
	{/snippet}
</PageContainer>
