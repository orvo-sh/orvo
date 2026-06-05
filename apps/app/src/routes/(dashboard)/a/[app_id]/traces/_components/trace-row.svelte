<script lang="ts">
	import { Badge } from '@repo/components/ui/badge';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { TraceRow } from '../types';

	export function formatDuration(ns: number | string): string {
		const n = Number(ns);
		if (!Number.isFinite(n)) return '—';
		const ms = n / 1_000_000;
		if (ms < 1) return `${Math.round(n / 1_000)}µs`;
		if (ms < 1000) return `${ms.toFixed(ms < 10 ? 2 : 1)}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}

	function fmtTime(iso: string): string {
		return new Date(iso).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
	}

	let {
		trace
	}: {
		trace: TraceRow;
	} = $props();

	const hasErrors = $derived(Number(trace.error_count) > 0);
	const borderClass = $derived(hasErrors ? 'border-l-destructive' : 'border-l-border');
	const traceHref = $derived(`/a/${page.params.app_id}/traces/${trace.trace_id}`);
</script>

<div
	class="group flex items-center border-l-2 {borderClass} hover:bg-muted/30 transition-colors cursor-pointer min-h-9 px-3 py-1.5 gap-0 border-b border-b-border/40"
	onclick={() => goto(traceHref)}
	onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && goto(traceHref)}
	role="row"
	tabindex="0"
>
	<!-- Name + trace ID -->
	<div class="flex-1 min-w-0 mr-3">
		<div class="text-xs font-medium text-foreground truncate">
			{trace.name || 'Unnamed trace'}
		</div>
		<div class="text-[10px] font-mono text-muted-foreground/60 truncate">{trace.trace_id.slice(0, 16)}…</div>
	</div>

	<!-- Duration -->
	<div class="shrink-0 w-20 text-xs font-mono text-muted-foreground tabular-nums mr-3">
		{formatDuration(trace.duration_ns)}
	</div>

	<!-- Span count -->
	<div class="shrink-0 w-14 text-xs text-muted-foreground tabular-nums mr-3">
		{Number(trace.span_count).toLocaleString()} spans
	</div>

	<!-- Error count -->
	<div class="shrink-0 w-16 mr-3">
		{#if hasErrors}
			<Badge variant="destructive" class="text-[10px] h-4 px-1.5">
				{Number(trace.error_count).toLocaleString()} err
			</Badge>
		{:else}
			<span class="text-[10px] text-muted-foreground/50">—</span>
		{/if}
	</div>

	<!-- Services -->
	<div class="shrink-0 w-36 text-xs text-muted-foreground truncate mr-3" title={trace.service_names.join(', ')}>
		{trace.service_names.join(', ') || '—'}
	</div>

	<!-- Environment -->
	<div class="shrink-0 w-24 mr-3">
		{#if trace.deployment_environments[0]}
			<span class="inline-flex items-center rounded-sm border border-border/60 px-1.5 py-px text-[10px] font-medium text-muted-foreground">
				{trace.deployment_environments[0]}
			</span>
		{/if}
	</div>

	<!-- Start time -->
	<div class="shrink-0 w-40 text-[11px] font-mono text-muted-foreground tabular-nums">
		{fmtTime(trace.start_time)}
	</div>
</div>
