<script lang="ts">
	/**
	 * Log Volume Chart — a histogram showing log event density over time.
	 *
	 * Mechanics:
	 *  - The time range is divided into N equal buckets.
	 *  - Each bucket accumulates a count per severity level.
	 *  - Bars are stacked: fatal/error at top (red), warn (amber), info/debug/trace (muted blue).
	 *  - Bar height is proportional to the bucket's total count vs. the max across all buckets.
	 *  - Hovering a bar shows a tooltip with the breakdown and the bucket's time window.
	 *  - Clicking a bar narrows the time range to that bucket (calls onBucketClick).
	 *
	 * This is the same pattern used by Datadog, Grafana Loki, Railway, and Hookdeck.
	 */

	import type { LogRecord } from '../types';

	type Bucket = {
		start: Date;
		end: Date;
		fatal: number;
		error: number;
		warn: number;
		info: number;
		debug: number;
		trace: number;
		total: number;
	};

	const BUCKET_COUNT = 80;

	const SEVERITY_COLOR: Record<string, string> = {
		fatal: 'var(--color-destructive)',
		error: 'var(--color-destructive)',
		warn: '#f59e0b',
		info: 'var(--color-primary)',
		debug: 'color-mix(in srgb, var(--color-muted-foreground) 50%, transparent)',
		trace: 'color-mix(in srgb, var(--color-muted-foreground) 30%, transparent)'
	};

	function severityBucket(sev: string): keyof Omit<Bucket, 'start' | 'end' | 'total'> {
		const s = (sev ?? '').toLowerCase();
		if (s === 'fatal') return 'fatal';
		if (s === 'error' || s.includes('err')) return 'error';
		if (s === 'warn' || s.includes('warn')) return 'warn';
		if (s === 'debug' || s.includes('debug')) return 'debug';
		if (s === 'trace') return 'trace';
		return 'info';
	}

	let {
		logs = [],
		start,
		end,
		onBucketClick
	}: {
		logs?: LogRecord[];
		start: Date;
		end: Date;
		onBucketClick?: (bucketStart: Date, bucketEnd: Date) => void;
	} = $props();

	const buckets = $derived.by(() => {
		const rangeMs = end.getTime() - start.getTime();
		const bucketMs = rangeMs / BUCKET_COUNT;

		const b: Bucket[] = Array.from({ length: BUCKET_COUNT }, (_, i) => ({
			start: new Date(start.getTime() + i * bucketMs),
			end: new Date(start.getTime() + (i + 1) * bucketMs),
			fatal: 0,
			error: 0,
			warn: 0,
			info: 0,
			debug: 0,
			trace: 0,
			total: 0
		}));

		for (const log of logs) {
			const t = new Date(log.timestamp).getTime();
			const idx = Math.min(
				Math.floor(((t - start.getTime()) / rangeMs) * BUCKET_COUNT),
				BUCKET_COUNT - 1
			);
			if (idx < 0 || idx >= BUCKET_COUNT) continue;
			const key = severityBucket(log.severity_text);
			b[idx][key]++;
			b[idx].total++;
		}

		return b;
	});

	const maxCount = $derived(Math.max(1, ...buckets.map((b) => b.total)));

	// X-axis time labels: 6 evenly spaced labels
	const timeLabels = $derived.by(() => {
		const count = 6;
		return Array.from({ length: count }, (_, i) => {
			const t = new Date(start.getTime() + (i / (count - 1)) * (end.getTime() - start.getTime()));
			return {
				x: (i / (count - 1)) * 100,
				label: t.toLocaleString('en-US', {
					month: 'short',
					day: 'numeric',
					hour: 'numeric',
					minute: '2-digit',
					hour12: true
				})
			};
		});
	});

	let hovered = $state<number | null>(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	function fmt(d: Date) {
		return d.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit',
			hour12: true
		});
	}

	const CHART_HEIGHT = 56;
	const LABEL_HEIGHT = 20;
	const GAP = 1;
</script>

<div class="w-full select-none">
	<!-- Histogram SVG -->
	<div
		class="relative w-full"
		role="img"
		aria-label="Log volume over time"
	>
		<svg
			width="100%"
			height={CHART_HEIGHT + LABEL_HEIGHT}
			class="overflow-visible"
			role="presentation"
			onmouseleave={() => (hovered = null)}
		>
			<!-- Bars -->
			{#each buckets as bucket, i}
				{@const barW = `${(1 / BUCKET_COUNT) * 100}%`}
				{@const x = `${(i / BUCKET_COUNT) * 100}%`}
				{@const hasError = bucket.error + bucket.fatal > 0}
				{@const hasWarn = bucket.warn > 0}
				{@const color = hasError
					? SEVERITY_COLOR.error
					: hasWarn
						? SEVERITY_COLOR.warn
						: SEVERITY_COLOR.info}
				{@const heightPct = bucket.total === 0 ? 0 : Math.max(2, (bucket.total / maxCount) * CHART_HEIGHT)}

				<g
					onmouseenter={(e) => {
						hovered = i;
						tooltipX = e.clientX;
						tooltipY = e.clientY;
					}}
					onmousemove={(e) => {
						tooltipX = e.clientX;
						tooltipY = e.clientY;
					}}
					onclick={() => bucket.total > 0 && onBucketClick?.(bucket.start, bucket.end)}
					onkeydown={(e) => {
						if (bucket.total > 0 && (e.key === 'Enter' || e.key === ' ')) {
							e.preventDefault();
							onBucketClick?.(bucket.start, bucket.end);
						}
					}}
					style="cursor: {bucket.total > 0 ? 'pointer' : 'default'}"
					role="button"
					tabindex={bucket.total > 0 ? 0 : -1}
					aria-label="Bucket {i}: {bucket.total} logs"
				>
					<!-- Hover hit area -->
					<rect
						x={x}
						y={0}
						width={barW}
						height={CHART_HEIGHT}
						fill={hovered === i ? 'color-mix(in srgb, currentColor 6%, transparent)' : 'transparent'}
						class="text-foreground"
					/>
					<!-- Actual bar -->
					{#if bucket.total > 0}
						<rect
							x={x}
							y={CHART_HEIGHT - heightPct}
							width={barW}
							height={heightPct - GAP}
							fill={color}
							opacity={hovered === i ? 1 : 0.75}
							rx="1"
						/>
					{:else}
						<!-- Flat tick for empty buckets -->
						<rect
							x={x}
							y={CHART_HEIGHT - 1}
							width={barW}
							height={1}
							fill="var(--color-border)"
							opacity={0.4}
						/>
					{/if}
				</g>
			{/each}

			<!-- X-axis line -->
			<line
				x1="0"
				y1={CHART_HEIGHT}
				x2="100%"
				y2={CHART_HEIGHT}
				stroke="var(--color-border)"
				stroke-width="1"
			/>

			<!-- Time labels -->
			{#each timeLabels as { x, label }, i}
				<text
					x="{x}%"
					y={CHART_HEIGHT + LABEL_HEIGHT - 2}
					font-size="10"
					fill="var(--color-muted-foreground)"
					text-anchor={i === 0 ? 'start' : i === timeLabels.length - 1 ? 'end' : 'middle'}
				>
					{label}
				</text>
			{/each}
		</svg>

		<!-- Tooltip -->
		{#if hovered !== null}
			{@const b = buckets[hovered]}
			<div
				class="pointer-events-none fixed z-50 rounded-md border bg-popover px-2.5 py-2 text-xs shadow-md"
				style="left: {tooltipX + 12}px; top: {tooltipY - 8}px; transform: translateY(-100%)"
			>
				<p class="text-muted-foreground mb-1">
					{fmt(b.start)} → {fmt(b.end)}
				</p>
				<div class="flex flex-col gap-0.5">
					{#if b.fatal + b.error > 0}
						<div class="flex items-center gap-1.5">
							<span class="size-2 rounded-sm bg-destructive shrink-0"></span>
							<span class="text-foreground">{b.fatal + b.error} error{b.fatal + b.error !== 1 ? 's' : ''}</span>
						</div>
					{/if}
					{#if b.warn > 0}
						<div class="flex items-center gap-1.5">
							<span class="size-2 rounded-sm shrink-0" style="background: #f59e0b"></span>
							<span class="text-foreground">{b.warn} warning{b.warn !== 1 ? 's' : ''}</span>
						</div>
					{/if}
					{#if b.info > 0}
						<div class="flex items-center gap-1.5">
							<span class="size-2 rounded-sm bg-primary shrink-0"></span>
							<span class="text-foreground">{b.info} info</span>
						</div>
					{/if}
					{#if b.debug + b.trace > 0}
						<div class="flex items-center gap-1.5">
							<span class="size-2 rounded-sm bg-muted-foreground/40 shrink-0"></span>
							<span class="text-foreground">{b.debug + b.trace} debug/trace</span>
						</div>
					{/if}
					{#if b.total === 0}
						<span class="text-muted-foreground">No logs</span>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
