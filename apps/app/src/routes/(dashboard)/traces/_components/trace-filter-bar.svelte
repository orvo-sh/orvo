<script lang="ts">
	import { Input } from '@repo/components/ui/input';
	import {
		CpuIcon,
		FunnelSimpleIcon,
		LightningIcon,
		MagnifyingGlassIcon,
		StackIcon
	} from 'phosphor-svelte';
	import TimeRangePicker from '../../logs/[[view_slug]]/_components/time-range-picker.svelte';
	import FilterPill from '../../logs/[[view_slug]]/_components/filter-pill.svelte';
	import type { TraceFilters } from '../types';

	const STATUS_OPTIONS = [
		{ value: '2', label: 'Error', color: '#ef4444' },
		{ value: '1', label: 'OK', color: '#22c55e' },
		{ value: '0', label: 'Unset', color: '#6b7280' }
	];

	let {
		start = $bindable<Date>(),
		end = $bindable<Date>(),
		filters = $bindable<TraceFilters>({
			search: '',
			services: [],
			environments: [],
			statusCodes: []
		}),
		serviceOptions = [],
		environmentOptions = []
	}: {
		start?: Date;
		end?: Date;
		filters?: TraceFilters;
		serviceOptions?: { value: string; label: string }[];
		environmentOptions?: { value: string; label: string }[];
	} = $props();
</script>

<div class="flex flex-wrap items-center gap-2 px-4 py-2 border-b bg-background">
	<TimeRangePicker bind:start bind:end />

	<span class="h-5 w-px bg-border mx-0.5"></span>

	<div class="relative flex items-center">
		<MagnifyingGlassIcon class="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
		<Input
			placeholder="Search traces or trace ID"
			bind:value={filters.search}
			class="h-8 pl-7 pr-3 text-sm w-56 bg-muted/40 border-border/60 focus:bg-background"
		/>
	</div>

	<span class="h-5 w-px bg-border mx-0.5"></span>

	<FilterPill
		label="Status"
		bind:values={filters.statusCodes}
		options={STATUS_OPTIONS}
		placeholder="Filter by status..."
	>
		{#snippet icon()}
			<LightningIcon class="size-3.5" />
		{/snippet}
	</FilterPill>

	{#if serviceOptions.length > 0}
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
	{/if}

	{#if environmentOptions.length > 0}
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
	{/if}

	<button
		class="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
	>
		<FunnelSimpleIcon class="size-3.5" />
		More filters
	</button>
</div>
