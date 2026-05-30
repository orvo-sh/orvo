<script lang="ts">
	import { ArrowsClockwiseIcon, TreeStructureIcon } from 'phosphor-svelte';
	import TraceRow from './trace-row.svelte';
	import type { TraceFilters, TraceRow as TraceRowType } from '../types';

	let {
		traces = [],
		filters,
		loading = false
	}: {
		traces?: TraceRowType[];
		filters: TraceFilters;
		loading?: boolean;
	} = $props();

	const filtered = $derived.by(() => {
		let result = traces;

		if (filters.search) {
			const q = filters.search.toLowerCase();
			result = result.filter(
				(t) =>
					t.name?.toLowerCase().includes(q) ||
					t.trace_id.toLowerCase().includes(q) ||
					t.service_names.some((s) => s.toLowerCase().includes(q))
			);
		}

		if (filters.services.length > 0) {
			result = result.filter((t) =>
				t.service_names.some((s) => filters.services.includes(s))
			);
		}

		if (filters.environments.length > 0) {
			result = result.filter((t) =>
				t.deployment_environments.some((e) => filters.environments.includes(e))
			);
		}

		if (filters.statusCodes.length > 0) {
			const hasError = filters.statusCodes.includes('2');
			const hasOk = filters.statusCodes.includes('1');
			if (hasError && !hasOk) result = result.filter((t) => Number(t.error_count) > 0);
			else if (hasOk && !hasError) result = result.filter((t) => Number(t.error_count) === 0);
		}

		return result;
	});
</script>

<div class="flex flex-1 min-h-0 flex-col overflow-hidden">
	<!-- Table header -->
	<div
		class="flex items-center border-b bg-muted/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide shrink-0"
		role="row"
	>
		<div class="flex-1 min-w-0 mr-3">Trace</div>
		<div class="shrink-0 w-20 mr-3">Duration</div>
		<div class="shrink-0 w-14 mr-3">Spans</div>
		<div class="shrink-0 w-16 mr-3">Errors</div>
		<div class="shrink-0 w-36 mr-3">Services</div>
		<div class="shrink-0 w-24 mr-3">Environment</div>
		<div class="shrink-0 w-40">Start time</div>
	</div>

	<!-- Rows -->
	<div class="flex-1 overflow-y-auto" role="rowgroup">
		{#if loading}
			<div class="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
				<ArrowsClockwiseIcon class="size-5 animate-spin" />
				<span class="text-sm">Loading traces…</span>
			</div>
		{:else if filtered.length === 0}
			<div class="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
				<TreeStructureIcon class="size-8 opacity-30" />
				<div class="text-center">
					<p class="text-sm font-medium text-foreground">No traces found</p>
					<p class="text-xs mt-0.5">
						{traces.length > 0
							? 'Try adjusting your filters or time range.'
							: 'No traces ingested in this time window.'}
					</p>
				</div>
			</div>
		{:else}
			{#each filtered as trace (trace.trace_id)}
				<TraceRow {trace} />
			{/each}
		{/if}
	</div>

	{#if !loading && filtered.length > 0}
		<div class="shrink-0 border-t px-4 py-1.5 text-[11px] text-muted-foreground flex items-center justify-between">
			<span>
				Showing <strong class="text-foreground font-medium">{filtered.length}</strong>
				{#if filtered.length !== traces.length}of {traces.length}{/if}
				trace{filtered.length !== 1 ? 's' : ''}
			</span>
			<span class="text-[10px]">Newest first</span>
		</div>
	{/if}
</div>
