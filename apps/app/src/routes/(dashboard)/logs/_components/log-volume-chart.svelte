<script lang="ts">
	import * as HoverCard from '@repo/components/ui/hover-card';
	import type { LogVolumeBucket } from '../types';

	type GenerateBarDistributionParams = {
		bucketSize: number;
		seed?: number;
		smoothness?: number;
		spikiness?: number;
		min?: number;
		max?: number;
	};

	type ChartBar = {
		color: string;
		height: number;
		index: number;
		isClickable: boolean;
		key: string;
		label: string;
		bucket?: LogVolumeBucket;
	};

	const CHART_HEIGHT = 68;
	const LABEL_HEIGHT = 20;
	const MIN_BAR_HEIGHT = 2;
	const TIME_LABEL_COUNT = 6;
	const CHART_DOT_ROW_COUNT = 6;
	const SKELETON_SEED = 42;
	const SKELETON_SMOOTHNESS = 0.45;
	const SKELETON_SPIKINESS = 0.28;
	const SKELETON_MIN = 0.1;
	const SKELETON_MAX = 1;
	const SEVERITY_COLORS = {
		error: 'var(--color-destructive)',
		info: 'var(--color-primary)',
		warn: '#f59e0b'
	} as const;

	const seededRandom = (seed: number) => {
		let value = seed;

		return () => {
			value |= 0;
			value = (value + 0x6d2b79f5) | 0;

			let t = Math.imul(value ^ (value >>> 15), 1 | value);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	};

	const clamp = (value: number, min: number, max: number) => {
		return Math.min(max, Math.max(min, value));
	};

	const generateBarDistribution = ({
		bucketSize,
		seed = 1,
		smoothness = 0.45,
		spikiness = 0.28,
		min = 0.1,
		max = 1
	}: GenerateBarDistributionParams) => {
		const size = Math.max(0, Math.floor(bucketSize));

		if (size === 0) {
			return [];
		}

		const random = seededRandom(seed);
		let previous = 0.28 + random() * 0.38;

		return Array.from({ length: size }, () => {
			const noise = random();
			const shouldSpike = random() > 1 - spikiness * 0.55;
			const spike = shouldSpike ? random() * 0.46 : 0;

			const value = previous * smoothness + noise * (1 - smoothness) + spike;

			previous = value;

			return clamp(value, min, max);
		});
	};

	const createSkeletonBars = (count: number): ChartBar[] => {
		const values = generateBarDistribution({
			bucketSize: count,
			seed: SKELETON_SEED,
			smoothness: SKELETON_SMOOTHNESS,
			spikiness: SKELETON_SPIKINESS,
			min: SKELETON_MIN,
			max: SKELETON_MAX
		});

		return values.map((value, index) => {
			const height = Math.max(MIN_BAR_HEIGHT, Math.round(value * CHART_HEIGHT));

			return {
				color: 'var(--color-muted)',
				height,
				index,
				isClickable: false,
				key: `skeleton-${index}`,
				label: `Loading bar ${index + 1}`
			};
		});
	};

	const getBucketColor = (bucket: LogVolumeBucket) => {
		if (bucket.error + bucket.fatal > 0) {
			return SEVERITY_COLORS.error;
		}

		if (bucket.warn > 0) {
			return SEVERITY_COLORS.warn;
		}

		return SEVERITY_COLORS.info;
	};

	const formatTimestamp = (date: Date) =>
		date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit',
			hour12: true
		});

	const formatTimeLabel = (date: Date) =>
		date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});

	let {
		buckets = [],
		loading = false,
		skeletonBucketCount = 40,
		start,
		end,
		onBucketClick
	}: {
		buckets?: LogVolumeBucket[];
		loading?: boolean;
		skeletonBucketCount?: number;
		start: Date;
		end: Date;
		onBucketClick?: (bucketStart: Date, bucketEnd: Date) => void;
	} = $props();

	const maxCount = $derived(Math.max(1, ...buckets.map((bucket) => bucket.total)));
	const skeletonBars = $derived(createSkeletonBars(skeletonBucketCount));

	const chartBars = $derived.by<ChartBar[]>(() => {
		if (loading) {
			return skeletonBars;
		}

		return buckets.map((bucket, index) => ({
			bucket,
			color: bucket.total > 0 ? getBucketColor(bucket) : 'var(--color-border)',
			height:
				bucket.total === 0 ? 1 : Math.max(MIN_BAR_HEIGHT, Math.round((bucket.total / maxCount) * CHART_HEIGHT)),
			index,
			isClickable: bucket.total > 0,
			key: `${bucket.startAtUtc}-${bucket.endAtUtc}`,
			label: `Bucket ${index + 1}: ${bucket.total} logs`
		}));
	});

	const timeLabels = $derived.by(() =>
		Array.from({ length: TIME_LABEL_COUNT }, (_, index) => {
			const ratio = index / (TIME_LABEL_COUNT - 1);
			const timestamp = new Date(start.getTime() + ratio * (end.getTime() - start.getTime()));

			return {
				justifyClass:
					index === 0
						? 'justify-start'
						: index === TIME_LABEL_COUNT - 1
							? 'justify-end'
							: 'justify-center',
				label: formatTimeLabel(timestamp)
			};
		})
	);

	const handleBucketClick = (bucket: LogVolumeBucket) => {
		if (bucket.total === 0) {
			return;
		}

		onBucketClick?.(new Date(bucket.startAtUtc), new Date(bucket.endAtUtc));
	};

	const handleBucketKeydown = (event: KeyboardEvent, bucket: LogVolumeBucket) => {
		if (bucket.total === 0 || (event.key !== 'Enter' && event.key !== ' ')) {
			return;
		}

		event.preventDefault();
		handleBucketClick(bucket);
	};
</script>

<div class="w-full select-none">
	<div
		class="relative w-full"
		role="img"
		aria-label={loading ? 'Loading log volume chart' : 'Log volume over time'}
	>
		<div
			class="rounded-md bg-muted/25 px-2 pt-2 pb-0.5"
		>
			<div class="relative flex items-end gap-0.5" style={`height: ${CHART_HEIGHT}px;`}>
				<div
					class="pointer-events-none absolute inset-0 grid gap-0.5"
					style={`grid-template-columns: repeat(${chartBars.length}, minmax(0, 1fr));`}
					aria-hidden="true"
				>
					{#each chartBars as _, index (`dot-column-${index}`)}
						<div class="flex h-full items-stretch justify-center">
							<div class="flex h-full flex-col justify-between py-1">
								{#each Array.from({ length: CHART_DOT_ROW_COUNT }) as _, dotIndex (`dot-${index}-${dotIndex}`)}
									<span
										class="block size-1 rounded-full bg-muted-foreground/15"
									></span>
								{/each}
							</div>
						</div>
					{/each}
				</div>

				{#each chartBars as bar (bar.key)}
					<div class="relative z-10 flex min-w-0 flex-1 items-end justify-center">
						{#if bar.bucket}
							{@const bucket = bar.bucket}
							<HoverCard.Root openDelay={50} closeDelay={50}>
								<HoverCard.Trigger
									type="button"
									class={`w-full rounded-sm transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
										bucket.total > 0
											? 'cursor-pointer opacity-80 hover:opacity-100 focus-visible:opacity-100'
											: 'cursor-default opacity-40 hover:opacity-60'
									}`}
									style={`height: ${bar.height}px; background: ${bar.color};`}
									aria-label={bar.label}
									tabindex={bucket.total > 0 ? 0 : -1}
									onclick={() => handleBucketClick(bucket)}
									onkeydown={(event) => handleBucketKeydown(event, bucket)}
								></HoverCard.Trigger>
								<HoverCard.Content class="w-72 text-sm">
									<p class="mb-1 text-muted-foreground">
										{formatTimestamp(new Date(bucket.startAtUtc))} →
										{formatTimestamp(new Date(bucket.endAtUtc))}
									</p>
									<div class="flex flex-col gap-0.5">
										{#if bucket.fatal + bucket.error > 0}
											<div class="flex items-center gap-1.5">
												<span class="size-2 shrink-0 rounded-sm bg-destructive"></span>
												<span class="text-foreground">
													{bucket.fatal + bucket.error} error{bucket.fatal + bucket.error !== 1 ? 's' : ''}
												</span>
											</div>
										{/if}
										{#if bucket.warn > 0}
											<div class="flex items-center gap-1.5">
												<span class="size-2 shrink-0 rounded-sm" style="background: #f59e0b"></span>
												<span class="text-foreground">
													{bucket.warn} warning{bucket.warn !== 1 ? 's' : ''}
												</span>
											</div>
										{/if}
										{#if bucket.info > 0}
											<div class="flex items-center gap-1.5">
												<span class="size-2 shrink-0 rounded-sm bg-primary"></span>
												<span class="text-foreground">{bucket.info} info</span>
											</div>
										{/if}
										{#if bucket.debug + bucket.trace > 0}
											<div class="flex items-center gap-1.5">
												<span class="size-2 shrink-0 rounded-sm bg-muted-foreground/40"></span>
												<span class="text-foreground">{bucket.debug + bucket.trace} debug/trace</span>
											</div>
										{/if}
										{#if bucket.total === 0}
											<span class="text-muted-foreground">No logs</span>
										{/if}
									</div>
								</HoverCard.Content>
							</HoverCard.Root>
						{:else}
							<div
								class="h-full w-full animate-pulse rounded-sm bg-muted"
								style={`height: ${bar.height}px;`}
								aria-hidden="true"
							></div>
						{/if}
					</div>
				{/each}
			</div>

			<div class="mt-0.5 h-px w-full bg-border"></div>
		</div>

		<div
			class="mt-2 grid"
			style={`grid-template-columns: repeat(${TIME_LABEL_COUNT}, minmax(0, 1fr)); height: ${LABEL_HEIGHT}px;`}
		>
			{#each timeLabels as label}
				<div class={`flex text-sm text-muted-foreground ${label.justifyClass}`}>
					<span>{label.label}</span>
				</div>
			{/each}
		</div>
	</div>
</div>
