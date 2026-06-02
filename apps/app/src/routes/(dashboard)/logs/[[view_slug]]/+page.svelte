<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
	    createDashboardLogViewCommand,
	    deleteDashboardLogViewCommand,
	    getDashboardLogViewsQuery,
	    updateDashboardLogViewCommand
	} from '$lib/api/dashboard-log-views.remote';
	import {
	    getLogFacetsQuery,
	    getLogsQuery,
	    getLogVolumeQuery
	} from '$lib/api/logs.remote';
	import { Button, buttonVariants } from '@repo/components/ui/button';
	import * as ButtonGroup from '@repo/components/ui/button-group';
	import * as DropdownMenu from '@repo/components/ui/dropdown-menu';
	import {
	    IconChevronDown,
	    IconDeviceFloppy,
	    IconFileDescription,
	    IconPencil,
	    IconReload,
	    IconTrash
	} from '@tabler/icons-svelte';

	import { cn } from '@repo/components';
	import PageContainer from '../../_components/page-container.svelte';
	import LogFilterBar from '../_components/log-filter-bar.svelte';
	import LogTable from '../_components/log-table.svelte';
	import LogVolumeChart from '../_components/log-volume-chart.svelte';
	import type {
	    LogFacets,
	    LogFilters,
	    LogRecord,
	    LogTimeFilter,
	    LogTimePreset,
	    LogVolumeBucket
	} from '../types.js';

	let {data} = $props();

	type DashboardLogView = {
		id: string;
		slug: string;
		name: string;
		definition: {
			version: 1;
			query: {
				time: LogTimeFilter;
				search: string;
				levels: string[];
				services: string[];
				environments: string[];
				scopes: string[];
				ingestionKeyIds: string[];
				traceId?: string;
				spanId?: string;
			};
			display: {
				columns: string[];
				sort: {
					field: string;
					direction: 'asc' | 'desc';
				};
				live: boolean;
			};
		};
	};

	type DashboardLogViewDefinition = DashboardLogView['definition'];

	const createDefaultFilters = (): LogFilters => ({
		search: '',
		levels: [],
		services: [],
		scopes: [],
		environments: [],
		traceId: ''
	});

	const createDefaultViewDefinition = (now: Date): DashboardLogViewDefinition => ({
		version: 1 as const,
		query: {
			time: {
				kind: 'range' as const,
				startAtUtc: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(),
				endAtUtc: now.toISOString()
			},
			search: '',
			levels: [],
			services: [],
			environments: [],
			scopes: [],
			ingestionKeyIds: [],
			traceId: undefined
		},
		display: {
			columns: [],
			sort: {
				field: 'timestamp',
				direction: 'desc' as const
			},
			live: false
		}
	});

	const getDefinitionSignature = (definition: DashboardLogViewDefinition) => JSON.stringify(definition);

	const initialNow = new Date();
	const createDefaultTimeFilter = (now: Date): LogTimeFilter => ({
		kind: 'range',
		startAtUtc: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(),
		endAtUtc: now.toISOString()
	});

	const createCurrentViewDefinition = () => ({
		version: 1 as const,
		query: {
			time: time,
			search: filters.search.trim(),
			levels: filters.levels,
			services: filters.services,
			environments: filters.environments,
			scopes: filters.scopes,
			ingestionKeyIds: [],
			traceId: filters.traceId.trim() || undefined
		},
		display: {
			columns: [],
			sort: {
				field: 'timestamp',
				direction: 'desc' as const
			},
			live
		}
	});

	const resolvePresetRange = (
		preset: LogTimePreset
	) => {
		const end = new Date();

		switch (preset) {
			case 'last_hour':
				return { start: new Date(end.getTime() - 60 * 60 * 1000), end };
			case 'today': {
				const start = new Date(end);
				start.setHours(0, 0, 0, 0);
				return { start, end };
			}
			case 'last_24_hours':
				return { start: new Date(end.getTime() - 24 * 60 * 60 * 1000), end };
			case 'last_3_days':
				return { start: new Date(end.getTime() - 3 * 24 * 60 * 60 * 1000), end };
			case 'last_7_days':
				return { start: new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000), end };
			case 'last_2_weeks':
				return { start: new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000), end };
			case 'last_month':
				return { start: new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000), end };
		}
	};

	const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

	let views = $state<DashboardLogView[]>([]);
	let viewsLoading = $state(false);
	let viewsError = $state('');
	let lastAppliedViewId = '';
	let live = $state(false);
	let time = $state<LogTimeFilter>(data.time);
	let rangeStart = $state(new Date(initialNow.getTime() - 10 * 60 * 60 * 1000));
	let rangeEnd = $state(initialNow);
	let filters = $state<LogFilters>(createDefaultFilters());
	let logs = $state<LogRecord[]>([]);
	let volumeBuckets = $state<LogVolumeBucket[]>([]);
	let loading = $state(false);
	let error = $state('');
	let loadRequest = 0;
	let logVolumeChartWidth = $state(0);
	let defaultViewDefinitionSignature = getDefinitionSignature(createDefaultViewDefinition(initialNow));

	let facets = $state<LogFacets>({
		levels: [],
		services: [],
		environments: [],
		scopes: [],
		ingestionKeyIds: []
	});

	const currentViewSlug = $derived(page.params.view_slug ?? '');
	const currentView = $derived(views.find((view) => view.slug === currentViewSlug) ?? null);

	const syncEffectiveRange = (time: LogTimeFilter) => {
		if (time.kind === 'range') {
			const start = new Date(time.startAtUtc);
			const end = new Date(time.endAtUtc);

			if (isValidDate(start) && isValidDate(end)) {
				rangeStart = start;
				rangeEnd = end;
				return;
			}

			const fallback = resolvePresetRange('last_24_hours');
			rangeStart = fallback.start;
			rangeEnd = fallback.end;
			return;
		}

		const { start, end } = resolvePresetRange(time.preset);
		rangeStart = start;
		rangeEnd = end;
	};

	const loadViews = async () => {
		viewsLoading = true;
		viewsError = '';

		const result = await getDashboardLogViewsQuery({}).run();
		if (result.success === false) {
			viewsError = result.error;
			viewsLoading = false;
			return null;
		}

		views = result.data.views as DashboardLogView[];
		viewsLoading = false;
		return result.data.views as DashboardLogView[];
	};

	const applyView = (view: DashboardLogView | null) => {
		if (!view) {
			lastAppliedViewId = '';
			return;
		}

		const { query, display } = view.definition;
		time = query.time;
		syncEffectiveRange(query.time);

		filters = {
			search: query.search,
			levels: query.levels,
			services: query.services,
			scopes: query.scopes,
			environments: query.environments,
			traceId: query.traceId ?? ''
		};
		live = display.live;
		lastAppliedViewId = view.id;
	};

	const createBaseLogsInput = () => ({
		time: time,
		search: filters.search.trim(),
		levels: filters.levels,
		services: filters.services,
		environments: filters.environments,
		scopes: filters.scopes,
		ingestionKeyIds: [],
		traceId: filters.traceId.trim() || undefined
	});

	const CHART_BAR_GAP_PX = 2;
	const CHART_TARGET_BAR_PX = 8;
	const MIN_VOLUME_BUCKET_COUNT = 24;
	const MAX_VOLUME_BUCKET_COUNT = 120;
	const NICE_BUCKET_INTERVALS_MS = [
		60_000,
		5 * 60_000,
		10 * 60_000,
		15 * 60_000,
		30 * 60_000,
		60 * 60_000,
		2 * 60 * 60_000,
		3 * 60 * 60_000,
		6 * 60 * 60_000,
		12 * 60 * 60_000,
		24 * 60 * 60_000
	];

	const clampBucketCount = (count: number) =>
		Math.min(MAX_VOLUME_BUCKET_COUNT, Math.max(MIN_VOLUME_BUCKET_COUNT, count));

	const resolveLogVolumeBucketCount = (width: number, start: Date, end: Date) => {
		if (width <= 0) {
			return MIN_VOLUME_BUCKET_COUNT;
		}

		const rangeMs = Math.max(end.getTime() - start.getTime(), 1);
		const widthBoundCount = clampBucketCount(
			Math.floor((width + CHART_BAR_GAP_PX) / (CHART_TARGET_BAR_PX + CHART_BAR_GAP_PX))
		);
		const idealBucketSizeMs = rangeMs / widthBoundCount;
		const bucketSizeMs =
			NICE_BUCKET_INTERVALS_MS.find((intervalMs) => intervalMs >= idealBucketSizeMs) ??
			Math.ceil(rangeMs / widthBoundCount);

		return clampBucketCount(Math.ceil(rangeMs / bucketSizeMs));
	};

	const logVolumeBucketCount = $derived(
		resolveLogVolumeBucketCount(logVolumeChartWidth, rangeStart, rangeEnd)
	);

	const refreshLogs = async () => {
		const requestId = ++loadRequest;
		loading = true;
		error = '';

		const [logsResult, volumeResult, facetsResult] = await Promise.all([
			getLogsQuery({
				...createBaseLogsInput(),
				limit: 250
			}).run(),
			getLogVolumeQuery({
				...createBaseLogsInput(),
				bucketCount: logVolumeBucketCount
			}).run(),
			getLogFacetsQuery({
				...createBaseLogsInput(),
				maxValuesPerFacet: 50
			}).run()
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
			viewId: currentView?.id ?? null,
			time: time,
			start: rangeStart.toISOString(),
			end: rangeEnd.toISOString(),
			bucketCount: logVolumeBucketCount,
			search: filters.search,
			levels: filters.levels,
			services: filters.services,
			scopes: filters.scopes,
			environments: filters.environments,
			traceId: filters.traceId
		})
	);

	const hasUnsavedViewChanges = $derived.by(() => {
		const currentDefinitionSignature = getDefinitionSignature(createCurrentViewDefinition());
		const baseDefinitionSignature = currentView
			? getDefinitionSignature(currentView.definition)
			: defaultViewDefinitionSignature;

		return currentDefinitionSignature !== baseDefinitionSignature;
	});

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
		if (time.kind === 'range') {
			time = {
				kind: 'range',
				startAtUtc: time.startAtUtc,
				endAtUtc: new Date().toISOString()
			};
			return;
		}

		syncEffectiveRange(time);
	};

	const onBucketClick = (start: Date, end: Date) => {
		time = {
			kind: 'range',
			startAtUtc: start.toISOString(),
			endAtUtc: end.toISOString()
		};
	};

	const goToView = async (slug: string) => {
		await goto(slug ? `/logs/${slug}` : '/logs');
	};

	const saveAsNewView = async (initialName = '') => {
		const name = window.prompt('View name', initialName || currentView?.name || '');
		if (!name?.trim()) {
			return;
		}

		error = '';
		const result = await createDashboardLogViewCommand({
			name: name.trim(),
			definition: createCurrentViewDefinition()
		});

		if (result.success === false) {
			error = result.error;
			return;
		}

		const latestViews = await loadViews();
		const createdView = latestViews?.find((view) => view.id === result.data.id) ?? null;
		if (createdView) {
			await goToView(createdView.slug);
		}
	};

	const saveView = async () => {
		if (!currentView) {
			await saveAsNewView();
			return;
		}

		error = '';
		const result = await updateDashboardLogViewCommand({
			id: currentView.id,
			name: currentView.name,
			definition: createCurrentViewDefinition()
		});

		if (result.success === false) {
			error = result.error;
			return;
		}

		await loadViews();
	};

	const renameView = async () => {
		if (!currentView) {
			return;
		}

		const name = window.prompt('Rename view', currentView.name);
		if (!name?.trim()) {
			return;
		}

		error = '';
		const result = await updateDashboardLogViewCommand({
			id: currentView.id,
			name: name.trim(),
			definition: currentView.definition
		});

		if (result.success === false) {
			error = result.error;
			return;
		}

		await loadViews();
	};

	const duplicateView = async () => {
		if (!currentView) {
			return;
		}

		await saveAsNewView(`${currentView.name} copy`);
	};

	const deleteView = async () => {
		if (!currentView) {
			return;
		}

		const confirmed = window.confirm(`Delete "${currentView.name}"?`);
		if (!confirmed) {
			return;
		}

		error = '';
		const result = await deleteDashboardLogViewCommand(currentView.id);
		if (result.success === false) {
			error = result.error;
			return;
		}

		await loadViews();
		await goToView('');
	};

	$effect(() => {
		void loadViews();
	});

	$effect(() => {
		const selectedView = currentView;

		if (selectedView && selectedView.id !== lastAppliedViewId) {
			applyView(selectedView);
			return;
		}

		if (!selectedView && !currentViewSlug && lastAppliedViewId) {
			const now = new Date();
			time = createDefaultTimeFilter(now);
			syncEffectiveRange(time);
			filters = createDefaultFilters();
			live = false;
			lastAppliedViewId = '';
			defaultViewDefinitionSignature = getDefinitionSignature(createDefaultViewDefinition(now));
			viewsError = '';
			return;
		}

		if (!selectedView && currentViewSlug && !viewsLoading) {
			lastAppliedViewId = '';
			viewsError = 'Saved view not found.';
		}
	});

	$effect(() => {
		time;
		syncEffectiveRange(time);
	});

	$effect(() => {
		if (!live) {
			return;
		}

		const id = setInterval(() => {
			if (time.kind === 'range') {
				time = {
					kind: 'range',
					startAtUtc: time.startAtUtc,
					endAtUtc: new Date().toISOString()
				};
				return;
			}

			syncEffectiveRange(time);
		}, 5000);

		return () => clearInterval(id);
	});

	$effect(() => {
		if (logVolumeChartWidth <= 0) {
			return;
		}

		querySignature;

		const timeout = setTimeout(() => {
			void refreshLogs();
		}, 250);

		return () => {
			clearTimeout(timeout);
		};
	});
</script>

<PageContainer title="Logs" class="overflow-hidden" innerClass="p-0!" scrollContent={false}>
	{#snippet helper()}
		<div class="space-y-2">
			<p>
				Logs represent structured records emitted by your services and infrastructure during
				runtime.
			</p>
			<p>
				Each entry captures the log body along with metadata like severity, service,
				environment, scope, and trace context so you can filter operational activity and
				correlate it back to the request or trace that produced it.
			</p>
			<Button
				href="https://orvo.sh/docs/logs"
				size="sm"
				target="_blank"
				variant="outline"
				class="mt-2 w-full"
			>
				<IconFileDescription data-slot="button-icon" />
				Logs docs
			</Button>
		</div>
	{/snippet}
	{#snippet actions()}
	<ButtonGroup.Root>
		<Button variant="outline" onclick={() => {
				live = !live;
				if (live) {
					rangeEnd = new Date();
				}
			}}>
				<span data-slot="button-icon" class="relative flex size-4 items-center justify-center mt-px">
					<span class={cn("absolute inline-flex size-2.5 animate-ping rounded-full bg-primary/30", live ?"flex" :"hidden")}></span>
					<span class={cn("relative inline-flex size-2.5 rounded-full transition-colors", live ? "bg-primary" : "bg-foreground/50")}></span>
				</span>
				Live mode
		</Button>
		<Button variant="outline" size="icon" onclick={refresh}>
			<IconReload data-slot="button-icon" />
		</Button>
	</ButtonGroup.Root>	
		<ButtonGroup.Root>
			<Button variant="outline" onclick={saveView} disabled={!hasUnsavedViewChanges}>
				<IconDeviceFloppy data-slot="button-icon" />
				Save view
			</Button>
			{#if currentView}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						aria-label="Open saved view actions"
						class={buttonVariants({ variant: 'outline', size: 'icon' })}
					>
						<IconChevronDown />
					</DropdownMenu.Trigger>

					<DropdownMenu.Content align="end" class="w-44">
						<DropdownMenu.Item onSelect={renameView}>
							<IconPencil />
							Rename view
						</DropdownMenu.Item>
						<DropdownMenu.Item onSelect={() => saveAsNewView(`${currentView.name} copy`)}>
							<IconDeviceFloppy />
							Save as new view
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Item  onSelect={deleteView}>
							<IconTrash />
							Delete view
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/if}
		</ButtonGroup.Root>
	{/snippet}
		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
			<LogFilterBar
				bind:time={time}
				bind:filters
				{serviceOptions}
				{environmentOptions}
				{scopeOptions}
			/>

			{#if error}
				<div class="border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<div
				class="shrink-0 border-b bg-background px-4 pt-3 pb-1"
				bind:clientWidth={logVolumeChartWidth}
			>
				<LogVolumeChart
					buckets={volumeBuckets}
					{loading}
					skeletonBucketCount={logVolumeBucketCount}
					start={rangeStart}
					end={rangeEnd}
					{onBucketClick}
				/>
			</div>

			<div class="flex min-h-0 flex-1 overflow-hidden">
				<LogTable {logs} {filters} {loading} />
			</div>
		</div>
	
</PageContainer>
