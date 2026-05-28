<script lang="ts">
	import { getTraceQuery, getTracesQuery } from '$lib/api/traces.remote';
	import { Badge } from '@repo/components/ui/badge';
	import { Button } from '@repo/components/ui/button';
	import { Input } from '@repo/components/ui/input';
	import {
		ArrowsClockwiseIcon,
		CopyIcon,
		PlayIcon,
		WarningCircleIcon
	} from 'phosphor-svelte';
	import PageContainer from '../_components/page-container.svelte';

	let live = $state(false);
	let rangeStart = $state(new Date(Date.now() - 10 * 60 * 60 * 1000));
	let rangeEnd = $state(new Date());
	let search = $state('');
	let services = $state('');
	let environments = $state('');
	let status = $state('all');
	let traces = $state<TraceRow[]>([]);
	let selectedTraceId = $state('');
	let spans = $state<SpanRow[]>([]);
	let loading = $state(false);
	let detailLoading = $state(false);
	let error = $state('');
	let detailError = $state('');
	let loadRequest = 0;
	let detailRequest = 0;

	$effect(() => {
		if (!live) return;
		const id = setInterval(() => {
			rangeEnd = new Date();
		}, 5000);
		return () => clearInterval(id);
	});

	const splitFilter = (value: string) =>
		value
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean);

	const createTracesInput = () => ({
		time: {
			kind: 'range' as const,
			startAtUtc: rangeStart.toISOString(),
			endAtUtc: rangeEnd.toISOString()
		},
		search: search.trim(),
		services: splitFilter(services),
		environments: splitFilter(environments),
		scopes: [],
		ingestionKeyIds: [],
		statusCodes: status === 'errors' ? [2] : [],
		limit: 100
	});

	const refreshTraces = async () => {
		const requestId = ++loadRequest;
		loading = true;
		error = '';

		const result = await getTracesQuery(createTracesInput()).run();

		if (requestId !== loadRequest) {
			return;
		}

		if (result.success === false) {
			error = result.error;
			loading = false;
			return;
		}

		traces = result.data.traces;
		loading = false;

		if (selectedTraceId && !traces.some((trace) => trace.trace_id === selectedTraceId)) {
			selectedTraceId = '';
			spans = [];
		}
	};

	const loadTrace = async (traceId: string) => {
		const requestId = ++detailRequest;
		selectedTraceId = traceId;
		detailLoading = true;
		detailError = '';

		const result = await getTraceQuery({ traceId }).run();

		if (requestId !== detailRequest) {
			return;
		}

		if (result.success === false) {
			detailError = result.error;
			detailLoading = false;
			return;
		}

		spans = result.data.spans;
		detailLoading = false;
	};

	const refresh = () => {
		rangeEnd = new Date();
	};

	const copyTraceId = async () => {
		if (!selectedTraceId) return;
		await navigator.clipboard.writeText(selectedTraceId);
	};

	const querySignature = $derived.by(() =>
		JSON.stringify({
			start: rangeStart.toISOString(),
			end: rangeEnd.toISOString(),
			search,
			services,
			environments,
			status
		})
	);

	const selectedTrace = $derived(traces.find((trace) => trace.trace_id === selectedTraceId));

	const waterfall = $derived.by(() => {
		if (spans.length === 0) {
			return [];
		}

		const start = Math.min(...spans.map((span) => new Date(span.start_time).getTime()));
		const end = Math.max(...spans.map((span) => new Date(span.end_time).getTime()));
		const total = Math.max(end - start, 1);
		const spanMap = Object.fromEntries(spans.map((span) => [span.span_id, span]));
		const depthMap: Record<string, number> = {};

		const depthFor = (span: SpanRow): number => {
			if (span.span_id in depthMap) {
				return depthMap[span.span_id];
			}

			const parent = span.parent_span_id ? spanMap[span.parent_span_id] : null;
			const depth = parent ? depthFor(parent) + 1 : 0;
			depthMap[span.span_id] = depth;
			return depth;
		};

		return spans.map((span) => {
			const spanStart = new Date(span.start_time).getTime();
			const spanEnd = new Date(span.end_time).getTime();

			return {
				span,
				depth: depthFor(span),
				left: Math.max(((spanStart - start) / total) * 100, 0),
				width: Math.max(((spanEnd - spanStart) / total) * 100, 0.5)
			};
		});
	});

	const traceDuration = $derived.by(() => {
		if (!selectedTrace) {
			return '';
		}

		return formatDuration(selectedTrace.duration_ns);
	});

	const formatDuration = (duration: number | string) => {
		const nanoseconds = Number(duration);

		if (!Number.isFinite(nanoseconds)) {
			return '—';
		}

		const milliseconds = nanoseconds / 1_000_000;

		if (milliseconds < 1) {
			return `${Math.round(nanoseconds / 1_000)}µs`;
		}

		if (milliseconds < 1000) {
			return `${milliseconds.toFixed(milliseconds < 10 ? 2 : 1)}ms`;
		}

		return `${(milliseconds / 1000).toFixed(2)}s`;
	};

	const formatDateTime = (value: string) =>
		new Intl.DateTimeFormat('en', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		}).format(new Date(value));

	const formatCount = (value: number | string) => Number(value).toLocaleString();

	$effect(() => {
		const signature = querySignature;

		const timeout = setTimeout(() => {
			if (!signature) return;
			void refreshTraces();
		}, 250);

		return () => {
			clearTimeout(timeout);
		};
	});

	type TraceRow = {
		trace_id: string;
		name: string;
		start_time: string;
		end_time: string;
		duration_ns: number | string;
		span_count: number | string;
		error_count: number | string;
		service_names: string[];
		deployment_environments: string[];
	};

	type SpanRow = {
		id: string;
		organization_id: string;
		ingestion_key_id: string;
		received_at: string;
		expires_at: string;
		trace_id: string;
		span_id: string;
		parent_span_id: string;
		trace_state: string;
		name: string;
		kind: number;
		start_time: string;
		end_time: string;
		duration_ns: number | string;
		status_code: number;
		status_message: string;
		resource_attributes: Record<string, string>;
		scope_attributes: Record<string, string>;
		span_attributes: Record<string, string>;
		resource_schema_url: string;
		scope_name: string;
		scope_version: string;
		scope_schema_url: string;
		events_json: string;
		links_json: string;
		service_name: string;
		deployment_environment: string;
	};
</script>

<PageContainer title="Traces" class="overflow-hidden">
	{#snippet actions()}
		<Button
			variant="outline"
			onclick={() => {
				live = !live;
				if (live) rangeEnd = new Date();
			}}
			class={live ? 'border-green-500/50 text-green-600 dark:text-green-400' : ''}
		>
			{#if live}
				<span class="size-2 animate-pulse rounded-full bg-green-500" data-slot="button-icon"></span>
				Live
			{:else}
				<PlayIcon data-slot="button-icon" />
				Live
			{/if}
		</Button>

		{#if !live}
			<Button variant="outline" onclick={refresh}>
				<ArrowsClockwiseIcon data-slot="button-icon" />
				Refresh
			</Button>
		{/if}
	{/snippet}

	<div class="flex min-h-0 flex-1 flex-col gap-4">
		<section class="rounded-xl border border-border bg-card p-3">
			<div class="grid gap-3 md:grid-cols-[minmax(16rem,1.5fr)_1fr_1fr_auto]">
				<Input placeholder="Search traces, spans, status" bind:value={search} />
				<Input placeholder="Services, comma-separated" bind:value={services} />
				<Input placeholder="Environments, comma-separated" bind:value={environments} />
				<select
					bind:value={status}
					class="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					<option value="all">All statuses</option>
					<option value="errors">Errors only</option>
				</select>
			</div>
		</section>

		<div class="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(28rem,0.9fr)]">
			<section class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
				<div class="flex items-center justify-between border-b border-border px-4 py-3">
					<div>
						<h2 class="text-sm font-medium text-foreground">Trace list</h2>
						<p class="text-xs text-muted-foreground">{traces.length} traces in range</p>
					</div>
					{#if loading}
						<span class="text-xs text-muted-foreground">Loading</span>
					{/if}
				</div>

				{#if error}
					<div class="flex items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
						<WarningCircleIcon class="size-4" />
						{error}
					</div>
				{/if}

				<div class="min-h-0 overflow-auto">
					<table class="w-full text-left text-sm">
						<thead class="sticky top-0 z-10 border-b border-border bg-muted/60 text-xs text-muted-foreground">
							<tr>
								<th class="px-4 py-2 font-medium">Trace</th>
								<th class="px-3 py-2 font-medium">Duration</th>
								<th class="px-3 py-2 font-medium">Spans</th>
								<th class="px-3 py-2 font-medium">Errors</th>
								<th class="px-3 py-2 font-medium">Service</th>
								<th class="px-3 py-2 font-medium">Environment</th>
								<th class="px-4 py-2 font-medium">Start</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#if traces.length === 0 && !loading}
								<tr>
									<td colspan="7" class="px-4 py-10 text-center text-sm text-muted-foreground">
										No traces found for this range.
									</td>
								</tr>
							{/if}

							{#each traces as trace (trace.trace_id)}
								<tr
									class="cursor-pointer bg-card transition-colors hover:bg-muted/40 data-[selected=true]:bg-muted"
									data-selected={trace.trace_id === selectedTraceId}
									onclick={() => loadTrace(trace.trace_id)}
								>
									<td class="max-w-80 px-4 py-3">
										<div class="truncate font-medium text-foreground">{trace.name || 'Unnamed trace'}</div>
										<div class="truncate font-mono text-xs text-muted-foreground">{trace.trace_id}</div>
									</td>
									<td class="whitespace-nowrap px-3 py-3 font-mono text-xs">
										{formatDuration(trace.duration_ns)}
									</td>
									<td class="whitespace-nowrap px-3 py-3">{formatCount(trace.span_count)}</td>
									<td class="whitespace-nowrap px-3 py-3">
										{#if Number(trace.error_count) > 0}
											<Badge variant="destructive">{formatCount(trace.error_count)}</Badge>
										{:else}
											<span class="text-muted-foreground">0</span>
										{/if}
									</td>
									<td class="max-w-40 px-3 py-3">
										<span class="truncate text-muted-foreground">
											{trace.service_names.join(', ') || '—'}
										</span>
									</td>
									<td class="max-w-36 px-3 py-3">
										<span class="truncate text-muted-foreground">
											{trace.deployment_environments.join(', ') || '—'}
										</span>
									</td>
									<td class="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
										{formatDateTime(trace.start_time)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>

			<section class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
				<div class="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
					<div class="min-w-0">
						<h2 class="truncate text-sm font-medium text-foreground">
							{selectedTrace?.name ?? 'Trace detail'}
						</h2>
						<p class="truncate font-mono text-xs text-muted-foreground">
							{selectedTraceId || 'Select a trace to inspect spans'}
						</p>
					</div>
					{#if selectedTraceId}
						<Button variant="outline" size="sm" onclick={copyTraceId}>
							<CopyIcon data-slot="button-icon" />
							Copy id
						</Button>
					{/if}
				</div>

				{#if detailError}
					<div class="flex items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
						<WarningCircleIcon class="size-4" />
						{detailError}
					</div>
				{/if}

				{#if selectedTrace}
					<div class="grid grid-cols-2 gap-3 border-b border-border px-4 py-3 text-sm lg:grid-cols-4">
						<div>
							<div class="text-xs text-muted-foreground">Duration</div>
							<div class="font-mono">{traceDuration}</div>
						</div>
						<div>
							<div class="text-xs text-muted-foreground">Start</div>
							<div>{formatDateTime(selectedTrace.start_time)}</div>
						</div>
						<div>
							<div class="text-xs text-muted-foreground">Services</div>
							<div class="truncate">{selectedTrace.service_names.join(', ') || '—'}</div>
						</div>
						<div>
							<div class="text-xs text-muted-foreground">Spans</div>
							<div>{formatCount(selectedTrace.span_count)}</div>
						</div>
					</div>
				{/if}

				<div class="min-h-0 flex-1 overflow-auto px-4 py-3">
					{#if !selectedTraceId}
						<div class="flex h-full min-h-80 items-center justify-center text-sm text-muted-foreground">
							Select a trace from the list.
						</div>
					{:else if detailLoading}
						<div class="flex h-full min-h-80 items-center justify-center text-sm text-muted-foreground">
							Loading trace spans.
						</div>
					{:else if spans.length === 0}
						<div class="flex h-full min-h-80 items-center justify-center text-sm text-muted-foreground">
							No spans found for this trace.
						</div>
					{:else}
						<div class="space-y-2">
							{#each waterfall as item (item.span.span_id)}
								<div class="grid grid-cols-[14rem_1fr_5rem] items-center gap-3 text-xs">
									<div class="min-w-0" style={`padding-left: ${item.depth * 14}px`}>
										<div class="truncate font-medium text-foreground">{item.span.name}</div>
										<div class="truncate text-muted-foreground">
											{item.span.service_name || 'unknown service'}
										</div>
									</div>
									<div class="relative h-7 rounded-md bg-muted">
										<div
											class="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-primary/70"
											class:bg-destructive={item.span.status_code === 2}
											style={`left: ${item.left}%; width: ${item.width}%`}
										></div>
									</div>
									<div class="text-right font-mono text-muted-foreground">
										{formatDuration(item.span.duration_ns)}
									</div>
									<div class="col-span-3 rounded-md border border-border bg-background px-3 py-2">
										<div class="grid gap-2 md:grid-cols-3">
											<div>
												<span class="text-muted-foreground">Status</span>
												<div>{item.span.status_message || item.span.status_code}</div>
											</div>
											<div>
												<span class="text-muted-foreground">Scope</span>
												<div class="truncate">{item.span.scope_name || '—'}</div>
											</div>
											<div>
												<span class="text-muted-foreground">Span id</span>
												<div class="truncate font-mono">{item.span.span_id}</div>
											</div>
										</div>
										{#if Object.keys(item.span.span_attributes ?? {}).length > 0}
											<pre class="mt-2 max-h-36 overflow-auto rounded-md bg-muted p-2 text-[11px] text-muted-foreground">{JSON.stringify(item.span.span_attributes, null, 2)}</pre>
										{/if}
										{#if item.span.events_json || item.span.links_json}
											<div class="mt-2 grid gap-2 md:grid-cols-2">
												<pre class="max-h-32 overflow-auto rounded-md bg-muted p-2 text-[11px] text-muted-foreground">{item.span.events_json || '[]'}</pre>
												<pre class="max-h-32 overflow-auto rounded-md bg-muted p-2 text-[11px] text-muted-foreground">{item.span.links_json || '[]'}</pre>
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</section>
		</div>
	</div>
</PageContainer>
