<script lang="ts">
	import { Input } from '@repo/components/ui/input';
	import {
	    LightningIcon,
	    BracketsCurlyIcon,
	    CpuIcon,
	    FunnelSimpleIcon,
	    MagnifyingGlassIcon,
	    StackIcon
	} from 'phosphor-svelte';
	import type { LogFilters } from '../types';
	import FilterPill from './filter-pill.svelte';
	import TimeRangePicker from './time-range-picker.svelte';

	const LEVEL_OPTIONS = [
		{ value: 'FATAL', label: 'Fatal', color: '#dc2626' },
		{ value: 'ERROR', label: 'Error', color: '#ef4444' },
		{ value: 'WARN', label: 'Warn', color: '#f59e0b' },
		{ value: 'INFO', label: 'Info', color: '#3b82f6' },
		{ value: 'DEBUG', label: 'Debug', color: '#6b7280' },
		{ value: 'TRACE', label: 'Trace', color: '#9ca3af' }
	];

	let {
		start = $bindable<Date>(),
		end = $bindable<Date>(),
		filters = $bindable<LogFilters>({
			search: '',
			levels: [],
			services: [],
			scopes: [],
			environments: [],
			traceId: ''
		}),
		serviceOptions = [],
		environmentOptions = [],
		scopeOptions = []
	}: {
		start?: Date;
		end?: Date;
		filters?: LogFilters;
		serviceOptions?: { value: string; label: string }[];
		environmentOptions?: { value: string; label: string }[];
		scopeOptions?: { value: string; label: string }[];
	} = $props();
</script>

<div class="flex flex-wrap items-center gap-2 px-4 py-2 border-b bg-background">
	<!-- Time range -->
	<TimeRangePicker bind:start bind:end />

	<!-- Divider -->
	<span class="h-5 w-px bg-border mx-0.5"></span>

	<!-- Payload search -->
	<div class="relative flex items-center">
		<MagnifyingGlassIcon
			class="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none"
		/>
		<Input
			placeholder="Search payload fields"
			bind:value={filters.search}
			class="h-8 pl-7 pr-3 text-sm w-52 bg-muted/40 border-border/60 focus:bg-background"
		/>
	</div>

	<!-- Divider -->
	<span class="h-5 w-px bg-border mx-0.5"></span>

	<!-- Level filter -->
	<FilterPill
		label="Level"
		bind:values={filters.levels}
		options={LEVEL_OPTIONS}
			placeholder="Filter by level..."
	>
		{#snippet icon()}
			<LightningIcon class="size-3.5" />
		{/snippet}
	</FilterPill>

	<!-- Service filter -->
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

	<!-- Environment filter -->
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

	<!-- Scope filter (shown as "Request body" equivalent — scoped to OpenTelemetry scope) -->
	{#if scopeOptions.length > 0}
		<FilterPill
			label="Scope"
			bind:values={filters.scopes}
			options={scopeOptions}
			placeholder="Filter by scope..."
		>
			{#snippet icon()}
				<BracketsCurlyIcon class="size-3.5" />
			{/snippet}
		</FilterPill>
	{/if}

	<!-- More filters placeholder -->
	<button
		class="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
	>
		<FunnelSimpleIcon class="size-3.5" />
		More filters
	</button>
</div>
