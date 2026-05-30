<script lang="ts">
	import {
		IconCheck as CheckIcon,
		IconColumns3 as ColumnsIcon,
		IconDatabase as DatabaseIcon,
		IconRefresh as ArrowsClockwiseIcon
	} from "@tabler/icons-svelte";
	import * as DropdownMenu from '@repo/components/ui/dropdown-menu';
	import type { LogFilters, LogRecord } from '../types';
	import LogRow from './log-row.svelte';

	export type ColumnKey = 'environment' | 'trace_id';

	const OPTIONAL_COLUMNS: { key: ColumnKey; label: string }[] = [
		{ key: 'environment', label: 'Environment' },
		{ key: 'trace_id', label: 'Trace ID' }
	];

	let {
		logs = [],
		filters,
		loading = false,
		timezone
	}: {
		logs?: LogRecord[];
		filters: LogFilters;
		loading?: boolean;
		timezone?: string;
	} = $props();

	let visibleCols = $state<Set<ColumnKey>>(new Set());

	function toggleCol(key: ColumnKey) {
		const next = new Set(visibleCols);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		visibleCols = next;
	}

	const filtered = $derived.by(() => {
		let result = logs;

		if (filters.levels.length > 0) {
			result = result.filter((l) =>
				filters.levels.some(
					(lv) => lv.toLowerCase() === (l.severity_text ?? '').toLowerCase()
				)
			);
		}

		if (filters.services.length > 0) {
			result = result.filter((l) => filters.services.includes(l.service_name));
		}

		if (filters.scopes.length > 0) {
			result = result.filter((l) => filters.scopes.includes(l.scope_name));
		}

		if (filters.environments.length > 0) {
			result = result.filter((l) => filters.environments.includes(l.deployment_environment));
		}

		if (filters.search) {
			const q = filters.search.toLowerCase();
			result = result.filter(
				(l) =>
					l.body?.toLowerCase().includes(q) ||
					l.service_name?.toLowerCase().includes(q) ||
					l.severity_text?.toLowerCase().includes(q) ||
					JSON.stringify(l.log_attributes).toLowerCase().includes(q) ||
					JSON.stringify(l.resource_attributes).toLowerCase().includes(q)
			);
		}

		if (filters.traceId) {
			result = result.filter((l) => l.trace_id === filters.traceId);
		}

		return result.slice().sort(
			(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
		);
	});

	const tz = $derived(timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
</script>

<div class="flex flex-1 min-h-0 flex-col overflow-hidden">
	<!-- Table header -->
	<div
		class="flex items-center gap-0 border-b bg-muted/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide shrink-0"
		role="row"
	>
		<span class="w-5 mr-1 shrink-0"></span>
		<span class="w-44 mr-3 shrink-0">Time ({tz})</span>
		<span class="w-28 mr-3 shrink-0">Service</span>
		{#if visibleCols.has('environment')}
			<span class="w-24 mr-3 shrink-0">Environment</span>
		{/if}
		{#if visibleCols.has('trace_id')}
			<span class="w-28 mr-3 shrink-0">Trace ID</span>
		{/if}
		<span class="flex-1">Data</span>

		<!-- Column picker -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="ml-2 flex items-center gap-1 rounded p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
				aria-label="Configure columns"
			>
				<ColumnsIcon class="size-3.5" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-44">
				<DropdownMenu.Label class="text-[10px] uppercase tracking-wide text-muted-foreground">
					Optional columns
				</DropdownMenu.Label>
				<DropdownMenu.Separator />
				{#each OPTIONAL_COLUMNS as col}
					<DropdownMenu.Item onSelect={() => toggleCol(col.key)} class="gap-2">
						<span
							class="flex size-4 items-center justify-center rounded border border-border transition-colors
							{visibleCols.has(col.key) ? 'bg-primary border-primary text-primary-foreground' : ''}"
						>
							{#if visibleCols.has(col.key)}
								<CheckIcon class="size-2.5" />
							{/if}
						</span>
						{col.label}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>

	<!-- Log rows -->
	<div class="flex-1 overflow-y-auto" role="rowgroup">
		{#if loading}
			<div class="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
				<ArrowsClockwiseIcon class="size-5 animate-spin" />
				<span class="text-sm">Loading logs...</span>
			</div>
		{:else if filtered.length === 0}
			<div class="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
				<DatabaseIcon class="size-8 opacity-30" />
				<div class="text-center">
					<p class="text-sm font-medium text-foreground">No logs found</p>
					<p class="text-xs mt-0.5">
						{logs.length > 0
							? 'Try adjusting your filters or time range.'
							: 'No logs ingested in this time window.'}
					</p>
				</div>
			</div>
		{:else}
			{#each filtered as log, i (log.timestamp + log.span_id + i)}
				<LogRow {log} prevLog={filtered[i + 1]} {timezone} {visibleCols} />
			{/each}
		{/if}
	</div>

	<!-- Footer count -->
	{#if !loading && filtered.length > 0}
		<div
			class="shrink-0 border-t px-4 py-1.5 text-[11px] text-muted-foreground flex items-center justify-between"
		>
			<span>
				Showing <strong class="text-foreground font-medium">{filtered.length}</strong>
				{#if filtered.length !== logs.length}
					of {logs.length}
				{/if}
				log{filtered.length !== 1 ? 's' : ''}
			</span>
			<span class="text-[10px]">Newest first</span>
		</div>
	{/if}
</div>
