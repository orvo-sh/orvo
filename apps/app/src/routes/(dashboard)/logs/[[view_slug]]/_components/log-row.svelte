<script lang="ts">
	import { CaretRightIcon, CopyIcon } from 'phosphor-svelte';
	import type { LogRecord } from '../types';
	import type { ColumnKey } from './log-table.svelte';

	type SeverityMeta = { label: string; bg: string; text: string; border: string };

	function severityMeta(sev: string): SeverityMeta {
		const s = (sev ?? '').toLowerCase();
		if (s === 'fatal')
			return {
				label: 'FATAL',
				bg: 'bg-destructive/10',
				text: 'text-destructive',
				border: 'border-l-destructive'
			};
		if (s.includes('err') || s === 'error')
			return {
				label: 'ERROR',
				bg: 'bg-destructive/8',
				text: 'text-destructive',
				border: 'border-l-destructive'
			};
		if (s.includes('warn'))
			return {
				label: 'WARN',
				bg: 'bg-amber-500/8',
				text: 'text-amber-500',
				border: 'border-l-amber-500'
			};
		if (s.includes('debug'))
			return {
				label: 'DEBUG',
				bg: '',
				text: 'text-muted-foreground',
				border: 'border-l-border'
			};
		if (s === 'trace')
			return {
				label: 'TRACE',
				bg: '',
				text: 'text-muted-foreground/60',
				border: 'border-l-border'
			};
		return {
			label: 'INFO',
			bg: '',
			text: 'text-primary',
			border: 'border-l-primary/60'
		};
	}

	function relativeMs(a: string, b: string): string {
		const diff = Math.abs(new Date(b).getTime() - new Date(a).getTime());
		if (diff < 1000) return `+${diff}ms`;
		if (diff < 60_000) return `+${(diff / 1000).toFixed(1)}s`;
		return `+${(diff / 60_000).toFixed(1)}m`;
	}

	function fmtTimestamp(ts: string): string {
		const d = new Date(ts);
		return d.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
	}

	function copyText(text: string) {
		navigator.clipboard.writeText(text);
	}

	function toggleExpanded() {
		expanded = !expanded;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleExpanded();
		}
	}

	let {
		log,
		prevLog,
		timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
		visibleCols = new Set<ColumnKey>()
	}: {
		log: LogRecord;
		prevLog?: LogRecord;
		timezone?: string;
		visibleCols?: Set<ColumnKey>;
	} = $props();

	let expanded = $state(false);

	const meta = $derived(severityMeta(log.severity_text));
	const rel = $derived(prevLog ? relativeMs(prevLog.timestamp, log.timestamp) : null);

	const hasAttributes = $derived(
		Object.keys(log.log_attributes ?? {}).length > 0 ||
			Object.keys(log.resource_attributes ?? {}).length > 0 ||
			Object.keys(log.scope_attributes ?? {}).length > 0
	);

	const allAttributes = $derived({
		...(log.resource_attributes ?? {}),
		...(log.scope_attributes ?? {}),
		...(log.log_attributes ?? {})
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="group border-l-2 {meta.border} {expanded
		? meta.bg + ' border-b'
		: 'hover:bg-muted/30'} transition-colors cursor-pointer"
	onclick={toggleExpanded}
	onkeydown={handleKeydown}
	role="row"
	tabindex="0"
	aria-expanded={expanded}
>
	<!-- Collapsed row -->
	<div class="flex items-start gap-0 min-h-8 px-3 py-1.5">
		<!-- Expand caret -->
		<span
			class="shrink-0 mt-0.5 mr-1 text-muted-foreground/60 transition-transform {expanded
				? 'rotate-90'
				: ''}"
		>
			<CaretRightIcon class="size-3" />
		</span>

		<!-- Timestamp -->
		<div class="shrink-0 w-44 text-xs text-muted-foreground font-mono tabular-nums mr-3 mt-0.5">
			{fmtTimestamp(log.timestamp)}
		</div>

		<!-- Service badge -->
		<div class="shrink-0 w-28 mr-3 mt-0.5">
			{#if log.service_name}
				<span class="text-xs font-medium text-foreground/80 truncate block" title={log.service_name}>
					{log.service_name}
				</span>
			{/if}
		</div>

		<!-- Optional: Environment -->
		{#if visibleCols.has('environment')}
			<div class="shrink-0 w-24 mr-3 mt-0.5">
				{#if log.deployment_environment}
					<span
						class="inline-flex items-center rounded-sm border border-border/60 px-1.5 py-px text-[10px] font-medium text-muted-foreground truncate"
						title={log.deployment_environment}
					>
						{log.deployment_environment}
					</span>
				{/if}
			</div>
		{/if}

		<!-- Optional: Trace ID -->
		{#if visibleCols.has('trace_id')}
			<div class="shrink-0 w-28 mr-3 mt-0.5">
				{#if log.trace_id}
					<span
						class="text-[10px] font-mono text-muted-foreground/70 truncate block"
						title={log.trace_id}
					>
						{log.trace_id.slice(0, 12)}…
					</span>
				{:else}
					<span class="text-[10px] text-muted-foreground/30">—</span>
				{/if}
			</div>
		{/if}

		<!-- Body -->
		<div class="flex-1 min-w-0 flex items-start gap-2">
			<span
				class="text-xs font-semibold shrink-0 mt-0.5 w-10 {meta.text}"
				title={log.severity_text}
			>
				{meta.label}
			</span>
			<span
				class="text-xs text-foreground font-mono leading-relaxed break-all {expanded ? '' : 'line-clamp-1'}"
			>
				{#if log.body}
					{log.body}
				{:else}
					<em class="text-muted-foreground">(empty body)</em>
				{/if}
			</span>
			{#if rel && !expanded}
				<span
					class="shrink-0 ml-1 text-[10px] text-muted-foreground/60 font-mono tabular-nums mt-0.5"
				>
					{rel}
				</span>
			{/if}
		</div>
	</div>

	<!-- Expanded detail panel -->
	{#if expanded}
		<div
			class="px-8 pb-3 pt-1 text-xs font-mono"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			<!-- Core fields -->
			<div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 mb-3">
				<span class="text-muted-foreground">timestamp</span>
				<span class="text-foreground">{log.timestamp}</span>

				{#if log.observed_timestamp && log.observed_timestamp !== log.timestamp}
					<span class="text-muted-foreground">observed_at</span>
					<span class="text-foreground">{log.observed_timestamp}</span>
				{/if}

				<span class="text-muted-foreground">severity</span>
				<span class="{meta.text} font-semibold"
					>{log.severity_text} ({log.severity_number})</span
				>

				{#if log.service_name}
					<span class="text-muted-foreground">service</span>
					<span class="text-foreground">{log.service_name}</span>
				{/if}

				{#if log.deployment_environment}
					<span class="text-muted-foreground">environment</span>
					<span class="text-foreground">{log.deployment_environment}</span>
				{/if}

				{#if log.scope_name}
					<span class="text-muted-foreground">scope</span>
					<span class="text-foreground"
						>{log.scope_name}{log.scope_version ? ` @ ${log.scope_version}` : ''}</span
					>
				{/if}

				{#if log.trace_id}
					<span class="text-muted-foreground">trace_id</span>
					<span class="text-foreground break-all">{log.trace_id}</span>
				{/if}

				{#if log.span_id}
					<span class="text-muted-foreground">span_id</span>
					<span class="text-foreground">{log.span_id}</span>
				{/if}
			</div>

			<!-- Body -->
			<div class="mb-3">
				<div class="flex items-center justify-between mb-1">
					<span class="text-muted-foreground text-[10px] uppercase tracking-wide">body</span>
					<button
						type="button"
						class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-[10px]"
						onclick={() => copyText(log.body)}
					>
						<CopyIcon class="size-2.5" />
						Copy
					</button>
				</div>
				<pre
					class="text-xs text-foreground bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all border border-border/40">{log.body}</pre>
			</div>

			<!-- Attributes -->
			{#if hasAttributes}
				<div>
					<span class="text-muted-foreground text-[10px] uppercase tracking-wide block mb-1"
						>Attributes</span
					>
					<div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 bg-muted/40 rounded p-2 border border-border/40">
						{#each Object.entries(allAttributes) as [k, v]}
							<span class="text-muted-foreground truncate">{k}</span>
							<span class="text-foreground break-all">{v}</span>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
