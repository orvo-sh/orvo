<script lang="ts">
	import { CopyIcon, XIcon } from 'phosphor-svelte';
	import type { SpanRow } from '../../types';
	import { formatDuration } from '../../utils';

	const KIND_LABELS: Record<number, string> = {
		0: 'Unspecified',
		1: 'Internal',
		2: 'Server',
		3: 'Client',
		4: 'Producer',
		5: 'Consumer'
	};

	const STATUS_META: Record<number, { label: string; class: string }> = {
		0: { label: 'Unset', class: 'text-muted-foreground' },
		1: { label: 'OK', class: 'text-green-600 dark:text-green-400' },
		2: { label: 'Error', class: 'text-destructive' }
	};

	const fmtTime = (iso: string): string => {
		return new Date(iso).toLocaleString('en-US', {
			month: 'short', day: 'numeric', year: 'numeric',
			hour: '2-digit', minute: '2-digit', second: '2-digit',
			fractionalSecondDigits: 3, hour12: false
		});
	};

	const parseJson = (raw: string): unknown => {
		try { return JSON.parse(raw); } catch { return null; }
	};

	const copyText = (text: string) => { navigator.clipboard.writeText(text); };

	let { span, onClose }: { span: SpanRow; onClose: () => void } = $props();

	const status = $derived(STATUS_META[span.status_code] ?? STATUS_META[0]);
	const events = $derived(parseJson(span.events_json) as unknown[] | null);
	const links = $derived(parseJson(span.links_json) as unknown[] | null);

	const hasAttrs = $derived(Object.keys(span.span_attributes ?? {}).length > 0);
	const hasResource = $derived(Object.keys(span.resource_attributes ?? {}).length > 0);
</script>

<div class="flex flex-col h-full overflow-hidden border-l bg-background">
	<!-- Panel header -->
	<div class="flex items-start justify-between gap-3 px-4 py-3 border-b shrink-0">
		<div class="min-w-0">
			<p class="text-sm font-medium text-foreground truncate">{span.name}</p>
			<p class="text-[10px] font-mono text-muted-foreground/60 mt-0.5 truncate">{span.span_id}</p>
		</div>
		<button
			class="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
			onclick={onClose}
			aria-label="Close panel"
		>
			<XIcon class="size-4" />
		</button>
	</div>

	<!-- Scrollable body -->
	<div class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 text-xs font-mono">
		<!-- Core fields -->
		<section>
			<h3 class="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-sans font-medium">Overview</h3>
			<div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
				<span class="text-muted-foreground">Status</span>
				<span class="{status.class} font-semibold">{status.label}{span.status_message ? ` — ${span.status_message}` : ''}</span>

				<span class="text-muted-foreground">Kind</span>
				<span class="text-foreground">{KIND_LABELS[span.kind] ?? span.kind}</span>

				<span class="text-muted-foreground">Duration</span>
				<span class="text-foreground">{formatDuration(span.duration_ns)}</span>

				<span class="text-muted-foreground">Start</span>
				<span class="text-foreground break-all">{fmtTime(span.start_time)}</span>

				<span class="text-muted-foreground">End</span>
				<span class="text-foreground break-all">{fmtTime(span.end_time)}</span>

				{#if span.service_name}
					<span class="text-muted-foreground">Service</span>
					<span class="text-foreground">{span.service_name}</span>
				{/if}

				{#if span.deployment_environment}
					<span class="text-muted-foreground">Environment</span>
					<span class="text-foreground">{span.deployment_environment}</span>
				{/if}

				{#if span.scope_name}
					<span class="text-muted-foreground">Scope</span>
					<span class="text-foreground">{span.scope_name}{span.scope_version ? ` @ ${span.scope_version}` : ''}</span>
				{/if}

				<span class="text-muted-foreground">Trace ID</span>
				<span class="flex items-center gap-1.5">
					<span class="text-foreground break-all">{span.trace_id}</span>
					<button
						class="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
						onclick={() => copyText(span.trace_id)}
					>
						<CopyIcon class="size-3" />
					</button>
				</span>

				{#if span.parent_span_id}
					<span class="text-muted-foreground">Parent</span>
					<span class="text-foreground">{span.parent_span_id}</span>
				{/if}
			</div>
		</section>

		<!-- Span attributes -->
		{#if hasAttrs}
			<section>
				<h3 class="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-sans font-medium">Attributes</h3>
				<div class="rounded border border-border/40 bg-muted/30 p-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
					{#each Object.entries(span.span_attributes) as [k, v]}
						<span class="text-muted-foreground truncate">{k}</span>
						<span class="text-foreground break-all">{v}</span>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Resource attributes -->
		{#if hasResource}
			<section>
				<h3 class="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-sans font-medium">Resource</h3>
				<div class="rounded border border-border/40 bg-muted/30 p-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
					{#each Object.entries(span.resource_attributes) as [k, v]}
						<span class="text-muted-foreground truncate">{k}</span>
						<span class="text-foreground break-all">{v}</span>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Events -->
		{#if events && events.length > 0}
			<section>
				<h3 class="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-sans font-medium">Events ({events.length})</h3>
				<pre class="rounded border border-border/40 bg-muted/30 p-2 text-[10px] overflow-x-auto whitespace-pre-wrap text-foreground">{JSON.stringify(events, null, 2)}</pre>
			</section>
		{/if}

		<!-- Links -->
		{#if links && links.length > 0}
			<section>
				<h3 class="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-sans font-medium">Links ({links.length})</h3>
				<pre class="rounded border border-border/40 bg-muted/30 p-2 text-[10px] overflow-x-auto whitespace-pre-wrap text-foreground">{JSON.stringify(links, null, 2)}</pre>
			</section>
		{/if}
	</div>
</div>
