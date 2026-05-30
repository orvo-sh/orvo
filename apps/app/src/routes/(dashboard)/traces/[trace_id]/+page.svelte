<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getTraceQuery } from '$lib/api/traces.remote';
	import {
		IconAlertCircle as WarningCircleIcon,
		IconArrowLeft as ArrowLeftIcon,
		IconBinaryTree2 as TreeStructureIcon,
		IconCheck as CheckIcon,
		IconCopy as CopyIcon
	} from "@tabler/icons-svelte";
	import { Button } from '@repo/components/ui/button';
	import { Badge } from '@repo/components/ui/badge';
	import { formatDuration } from '../utils';
	import SpanWaterfall from './_components/span-waterfall.svelte';
	import SpanDetailPanel from './_components/span-detail-panel.svelte';
	import type { SpanRow } from '../types';

	const traceId = $derived(page.params.trace_id ?? '');
	let spans = $state<SpanRow[]>([]);
	let loading = $state(false);
	let error = $state('');
	let loadRequest = 0;

	const loadTrace = async (id: string) => {
		if (!id) return;

		const requestId = ++loadRequest;
		loading = true;
		error = '';
		selectedSpanId = null;

		const result = await getTraceQuery({ traceId: id }).run();

		if (requestId !== loadRequest) {
			return;
		}

		if (result.success === false) {
			error = result.error;
			loading = false;
			return;
		}

		spans = result.data.spans;
		loading = false;
	};

	const traceMeta = $derived.by(() => {
		if (spans.length === 0) return null;
		const start = Math.min(...spans.map((s) => new Date(s.start_time).getTime()));
		const end = Math.max(...spans.map((s) => new Date(s.end_time).getTime()));
		const root = spans.find((s) => !s.parent_span_id) ?? spans[0];
		const services = [...new Set(spans.map((s) => s.service_name).filter(Boolean))];
		const errorCount = spans.filter((s) => s.status_code === 2).length;
		return {
			name: root.name,
			durationNs: (end - start) * 1_000_000,
			startTime: new Date(start).toLocaleString('en-US', {
				month: 'short', day: 'numeric', year: 'numeric',
				hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
			}),
			services,
			spanCount: spans.length,
			errorCount,
			environment: root.deployment_environment
		};
	});

	let selectedSpanId = $state<string | null>(null);
	const selectedSpan = $derived(selectedSpanId ? spans.find((s) => s.span_id === selectedSpanId) ?? null : null);

	let copied = $state(false);
	const copyTraceId = async () => {
		await navigator.clipboard.writeText(traceId);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	};

	$effect(() => {
		const id = traceId;
		if (!id) return;

		const timeout = setTimeout(() => {
			void loadTrace(id);
		}, 0);

		return () => clearTimeout(timeout);
	});
</script>

<div class="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
	<!-- Page header -->
	<header class="shrink-0 border-b bg-background/95 backdrop-blur px-4 py-3 flex items-start gap-4">
		<button
			class="shrink-0 mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
			onclick={() => goto(resolve('/traces'))}
		>
			<ArrowLeftIcon class="size-4" />
			Traces
		</button>

		<div class="flex-1 min-w-0">
			{#if traceMeta}
				<div class="flex items-center gap-2 flex-wrap">
					<h1 class="text-sm font-medium text-foreground truncate">
						{traceMeta.name}
					</h1>
					{#if traceMeta.errorCount > 0}
						<Badge variant="destructive" class="text-[10px]">
							<WarningCircleIcon class="size-3" />
							{traceMeta.errorCount} error{traceMeta.errorCount !== 1 ? 's' : ''}
						</Badge>
					{/if}
				</div>
				<p class="text-[11px] font-mono text-muted-foreground/60 mt-0.5 truncate">{traceId}</p>
			{/if}
		</div>

		<!-- Meta chips -->
		{#if traceMeta}
			<div class="shrink-0 flex items-center gap-4 text-xs">
				<div class="text-center">
					<div class="text-[10px] text-muted-foreground uppercase tracking-wide">Duration</div>
					<div class="font-mono font-medium text-foreground">{formatDuration(traceMeta.durationNs)}</div>
				</div>
				<div class="text-center">
					<div class="text-[10px] text-muted-foreground uppercase tracking-wide">Spans</div>
					<div class="font-medium text-foreground">{traceMeta.spanCount}</div>
				</div>
				<div class="text-center">
					<div class="text-[10px] text-muted-foreground uppercase tracking-wide">Services</div>
					<div class="font-medium text-foreground truncate max-w-40">{traceMeta.services.join(', ')}</div>
				</div>
				<div class="text-center">
					<div class="text-[10px] text-muted-foreground uppercase tracking-wide">Start</div>
					<div class="text-foreground tabular-nums">{traceMeta.startTime}</div>
				</div>
				{#if traceMeta.environment}
					<div class="text-center">
						<div class="text-[10px] text-muted-foreground uppercase tracking-wide">Env</div>
						<span class="inline-flex items-center rounded-sm border border-border/60 px-1.5 py-px text-[10px] font-medium text-muted-foreground">
							{traceMeta.environment}
						</span>
					</div>
				{/if}
			</div>
		{/if}

		<Button variant="outline" size="sm" onclick={copyTraceId} class="shrink-0">
			{#if copied}
				<CheckIcon data-slot="button-icon" />
				Copied
			{:else}
				<CopyIcon data-slot="button-icon" />
				Copy ID
			{/if}
		</Button>
	</header>

	<!-- Body: waterfall + optional span detail panel -->
	<div class="flex flex-1 min-h-0 overflow-hidden">
		{#if loading}
			<div class="flex flex-1 items-center justify-center gap-3 text-muted-foreground flex-col">
				<TreeStructureIcon class="size-8 opacity-30 animate-pulse" />
				<p class="text-sm">Loading trace spans…</p>
			</div>
		{:else if error}
			<div class="flex flex-1 items-center justify-center gap-3 text-destructive flex-col">
				<WarningCircleIcon class="size-8 opacity-70" />
				<p class="text-sm">{error}</p>
			</div>
		{:else if spans.length === 0}
			<div class="flex flex-1 items-center justify-center gap-3 text-muted-foreground flex-col">
				<TreeStructureIcon class="size-8 opacity-30" />
				<p class="text-sm">No spans found for this trace.</p>
			</div>
		{:else}
			<!-- Waterfall -->
			<div class="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
				<SpanWaterfall {spans} bind:selectedSpanId />
			</div>

			<!-- Span detail panel (slides in when a span is selected) -->
			{#if selectedSpan}
				<div class="w-80 shrink-0 min-h-0 flex flex-col overflow-hidden">
					<SpanDetailPanel span={selectedSpan} onClose={() => (selectedSpanId = null)} />
				</div>
			{/if}
		{/if}
	</div>
</div>
