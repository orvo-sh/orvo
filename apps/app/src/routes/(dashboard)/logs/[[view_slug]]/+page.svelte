<script lang="ts">
	import { browser } from '$app/environment';
	import { goto, replaceState } from '$app/navigation';
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
	import { onMount, untrack } from 'svelte';
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

	let { data } = $props();

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
	const LOG_TIME_PRESETS: LogTimePreset[] = [
		'last_hour',
		'today',
		'last_24_hours',
		'last_3_days',
		'last_7_days',
		'last_2_weeks',
		'last_month'
	];

	const createDefaultFilters = (): LogFilters => ({
		search: '',
		levels: [],
		services: [],
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

	const getCurrentSearchParams = () =>
		browser ? new URL(window.location.href).searchParams : page.url.searchParams;

	const createViewFilters = (view: DashboardLogView): LogFilters => ({
		search: view.definition.query.search,
		levels: view.definition.query.levels,
		services: view.definition.query.services,
		environments: view.definition.query.environments,
		traceId: view.definition.query.traceId ?? ''
	});

	const serializeFilterValues = (values: string[]) => values.join(',');

	const parseFilterValues = (searchParams: URLSearchParams, key: string) => {
		const values = searchParams
			.getAll(key)
			.flatMap((value) => value.split(','))
			.map((value) => value.trim())
			.filter(Boolean);

		return Array.from(new Set(values));
	};

	const createLogStateSearchParams = (time: LogTimeFilter, filters: LogFilters) => {
		const searchParams = new URLSearchParams();

		if (time.kind === 'range') {
			searchParams.set('start', time.startAtUtc);
			searchParams.set('end', time.endAtUtc);
		} else {
			searchParams.set('preset', time.preset);
		}

		if (filters.search) {
			searchParams.set('search', filters.search);
		}
		if (filters.traceId) {
			searchParams.set('traceId', filters.traceId);
		}

		if (filters.levels.length > 0) {
			searchParams.set('level', serializeFilterValues(filters.levels));
		}
		if (filters.services.length > 0) {
			searchParams.set('service', serializeFilterValues(filters.services));
		}
		if (filters.environments.length > 0) {
			searchParams.set('environment', serializeFilterValues(filters.environments));
		}
		return searchParams;
	};

	const resolveLogStateFromSearchParams = (
		searchParams: URLSearchParams,
		baseTime: LogTimeFilter,
		baseFilters: LogFilters
	) => {
		const levels = parseFilterValues(searchParams, 'level');
		const services = parseFilterValues(searchParams, 'service');
		const environments = parseFilterValues(searchParams, 'environment');
		const startAtUtc = searchParams.get('start');
		const endAtUtc = searchParams.get('end');
		const preset = searchParams.get('preset');
		const nextTime =
			startAtUtc && endAtUtc
				? {
					kind: 'range' as const,
					startAtUtc,
					endAtUtc
				}
				: preset && LOG_TIME_PRESETS.includes(preset as LogTimePreset)
					? {
						kind: 'preset' as const,
						preset: preset as LogTimePreset
					}
					: baseTime;

		return {
			time: nextTime,
			filters: {
				search: searchParams.get('search') ?? baseFilters.search,
				levels: levels.length > 0 ? levels : baseFilters.levels,
				services: services.length > 0 ? services : baseFilters.services,
				environments: environments.length > 0 ? environments : baseFilters.environments,
				traceId: searchParams.get('traceId') ?? baseFilters.traceId
			}
		};
	};

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
	const initialLogState = untrack(() =>
		resolveLogStateFromSearchParams(page.url.searchParams, data.time, createDefaultFilters())
	);

	let live = $state(false);
	let time = $state<LogTimeFilter>(initialLogState.time);
	let rangeStart = $state(new Date(initialNow.getTime() - 10 * 60 * 60 * 1000));
	let rangeEnd = $state(initialNow);
	let filters = $state<LogFilters>(initialLogState.filters);
	let logs = $state<LogRecord[]>([]);
	let volumeBuckets = $state<LogVolumeBucket[]>([]);
	let loading = $state(false);
	let error = $state('');
	let loadRequest = 0;
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
	const logTimezone = $derived(data.activeOrganizationTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
	const createBaseLogState = (view: DashboardLogView | null, now = new Date()) =>
		view
			? {
				time: view.definition.query.time,
				filters: createViewFilters(view)
			}
			: {
				time: createDefaultTimeFilter(now),
				filters: createDefaultFilters()
			};

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

		const { display } = view.definition;
		const baseState = createBaseLogState(view);
		const nextState = resolveLogStateFromSearchParams(
			getCurrentSearchParams(),
			baseState.time,
			baseState.filters
		);

		time = nextState.time;
		syncEffectiveRange(nextState.time);
		filters = nextState.filters;
		live = display.live;
		lastAppliedViewId = view.id;
	};

	const createBaseLogsInput = () => ({
		time: time,
		search: filters.search.trim(),
		levels: filters.levels,
		services: filters.services,
		environments: filters.environments,
		ingestionKeyIds: [],
		traceId: filters.traceId.trim() || undefined
	});

	const MIN_VOLUME_BUCKET_COUNT = 24;
	const MAX_VOLUME_BUCKET_COUNT = 120;
	const MINUTE_MS = 60_000;
	const HOUR_MS = 60 * MINUTE_MS;
	const DAY_MS = 24 * HOUR_MS;
	const DEFAULT_FALLBACK_BUCKET_COUNT = 72;
	const AUTO_VOLUME_BUCKET_SIZES_MS = [
		{ maxRangeMs: HOUR_MS, bucketSizeMs: MINUTE_MS },
		{ maxRangeMs: 4 * HOUR_MS, bucketSizeMs: 2 * MINUTE_MS },
		{ maxRangeMs: 6 * HOUR_MS, bucketSizeMs: 5 * MINUTE_MS },
		{ maxRangeMs: 12 * HOUR_MS, bucketSizeMs: 10 * MINUTE_MS },
		{ maxRangeMs: DAY_MS, bucketSizeMs: 20 * MINUTE_MS },
		{ maxRangeMs: 2 * DAY_MS, bucketSizeMs: 30 * MINUTE_MS },
		{ maxRangeMs: 7 * DAY_MS, bucketSizeMs: 2 * HOUR_MS },
		{ maxRangeMs: 30 * DAY_MS, bucketSizeMs: 12 * HOUR_MS }
	] as const;

	const clampBucketCount = (count: number) =>
		Math.min(MAX_VOLUME_BUCKET_COUNT, Math.max(MIN_VOLUME_BUCKET_COUNT, count));

	const resolveLogVolumeBucketCount = (start: Date, end: Date) => {
		const rangeMs = Math.max(end.getTime() - start.getTime(), 1);
		const bucketSizeMs =
			AUTO_VOLUME_BUCKET_SIZES_MS.find(({ maxRangeMs }) => rangeMs <= maxRangeMs)
				?.bucketSizeMs ?? Math.ceil(rangeMs / DEFAULT_FALLBACK_BUCKET_COUNT);

		return clampBucketCount(Math.ceil(rangeMs / bucketSizeMs));
	};

	const resolvedLogVolumeBucketCount = $derived(resolveLogVolumeBucketCount(rangeStart, rangeEnd));

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
				bucketCount: resolvedLogVolumeBucketCount
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

	const refreshQuerySignature = $derived.by(() =>
		JSON.stringify({
			viewId: currentView?.id ?? null,
			time: time,
			start: rangeStart.toISOString(),
			end: rangeEnd.toISOString(),
			search: filters.search,
			levels: filters.levels,
			services: filters.services,
			environments: filters.environments,
			traceId: filters.traceId
		})
	);
	const urlStateSearch = $derived(createLogStateSearchParams(time, filters).toString());

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
		const search = urlStateSearch ? `?${urlStateSearch}` : '';
		await goto(`${slug ? `/logs/${slug}` : '/logs'}${search}`);
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
			const baseState = createBaseLogState(null, now);
			const nextState = resolveLogStateFromSearchParams(
				getCurrentSearchParams(),
				baseState.time,
				baseState.filters
			);
			time = nextState.time;
			syncEffectiveRange(nextState.time);
			filters = nextState.filters;
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
		if (!browser) {
			return;
		}

		const nextSearch = urlStateSearch;
		const currentSearch = window.location.search.startsWith('?')
			? window.location.search.slice(1)
			: window.location.search;

		if (currentSearch === nextSearch) {
			return;
		}

		const url = new URL(window.location.href);
		url.search = nextSearch;
		replaceState(url, page.state);
	});

	$effect(() => {
		refreshQuerySignature;

		const timeout = setTimeout(() => {
			void refreshLogs();
		}, 250);

		return () => {
			clearTimeout(timeout);
		};
	});

	onMount(() => {
		const syncStateFromLocation = () => {
			const baseState = createBaseLogState(currentView);
			const nextState = resolveLogStateFromSearchParams(
				new URL(window.location.href).searchParams,
				baseState.time,
				baseState.filters
			);

			time = nextState.time;
			syncEffectiveRange(nextState.time);
			filters = nextState.filters;
		};

		window.addEventListener('popstate', syncStateFromLocation);
		return () => {
			window.removeEventListener('popstate', syncStateFromLocation);
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
				environment, and trace context so you can filter operational activity and
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
			/>

			{#if error}
				<div class="border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<LogVolumeChart
				buckets={volumeBuckets}
				{loading}
				skeletonBucketCount={resolvedLogVolumeBucketCount}
				start={rangeStart}
				end={rangeEnd}
				{onBucketClick}
			/>

			<div class="relative flex min-h-0 flex-1 overflow-hidden">
				<LogTable {logs} {loading} {time} timezone={logTimezone} />
			</div>
			</div>
	
</PageContainer>
