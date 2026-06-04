<script lang="ts">
	import { Input } from '@repo/components/ui/input';
	import { Kbd } from '@repo/components/ui/kbd';
	import {
	    IconCpu as CpuIcon,
	    IconBolt as LightningIcon,
	    IconSearch as MagnifyingGlassIcon,
	    IconStack2 as StackIcon
	} from "@tabler/icons-svelte";
	import type { LogFilters, LogTimeFilter } from '../types';
	import FilterPill from './filter-pill.svelte';
	import TimeRangePicker from './time-range-picker.svelte';

	let {
		time = $bindable<LogTimeFilter>(),
		filters = $bindable<LogFilters>({
			search: '',
			levels: [],
			services: [],
			environments: [],
			traceId: ''
		}),
		serviceOptions = [],
		environmentOptions = []
	}: {
		time?: LogTimeFilter;
		filters?: LogFilters;
		serviceOptions?: { value: string; label: string }[];
		environmentOptions?: { value: string; label: string }[];
	} = $props();

	let searchDraft = $state(filters.search);
	let lastAppliedSearch = $state(filters.search);

	const applySearch = () => {
		const nextSearch = searchDraft.trim();
		filters.search = nextSearch;
		lastAppliedSearch = nextSearch;
	};

	$effect(() => {
		if (filters.search !== lastAppliedSearch) {
			searchDraft = filters.search;
			lastAppliedSearch = filters.search;
		}
	});
</script>

<div class="flex flex-wrap items-center gap-2 p-2 px-3 bg-secondary">
	<TimeRangePicker bind:time />
	<div class="relative flex items-center">
		<MagnifyingGlassIcon
			class="absolute left-3 size-3.5 text-muted-foreground pointer-events-none"
		/>
		<Input
			placeholder="Search log messages"
			bind:value={searchDraft}
			class="pl-8 pr-14 bg-background"
			onkeydown={(event:KeyboardEvent) => {
				if (event.key === 'Enter') {
					applySearch();
				}
			}}
		/>
		{#if filters.search !== searchDraft.trim() && searchDraft.trim() !== ''}
			<Kbd class="absolute right-2 size-5 cursor-pointer">
				↵
			</Kbd>
		{/if}
	</div>
	<span class="h-5 w-px bg-border mx-1"></span>

	<FilterPill
		label="Level"
		bind:values={filters.levels}
		options={[
			{ value: 'FATAL', label: 'Fatal'},
			{ value: 'ERROR', label: 'Error'},
			{ value: 'WARN', label: 'Warn'},
			{ value: 'INFO', label: 'Info'},
			{ value: 'DEBUG', label: 'Debug'},
			{ value: 'TRACE', label: 'Trace'}
		]}
		placeholder="Filter by level..."
	>
		{#snippet icon()}
			<LightningIcon class="size-3.5" />
		{/snippet}
	</FilterPill>

	<FilterPill
		label="Service"
		bind:values={filters.services}
		options={serviceOptions}
		placeholder="Filter by service..."
	>
		{#snippet icon()}
			<CpuIcon class="size-3.5" />
		{/snippet}
	</FilterPill>

	<FilterPill
		label="Environment"
		bind:values={filters.environments}
		options={environmentOptions}
		placeholder="Filter by environment..."
	>
		{#snippet icon()}
			<StackIcon class="size-3.5" />
		{/snippet}
	</FilterPill>
</div>
