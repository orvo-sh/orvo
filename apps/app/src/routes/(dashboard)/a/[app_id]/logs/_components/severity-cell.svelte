<script lang="ts">
	import { cn } from '@repo/components';

	import { normalizeSeverity } from '$lib/utils/normalize-severity';

	let {
		severityNumber,
		severityText
	}: {
		severityNumber: number;
		severityText?: string;
	} = $props();

	const severity = $derived(normalizeSeverity(severityNumber, severityText));
	const severityClasses = $derived(
		{
			fatal: 'text-destructive/80',
			error: 'text-destructive/75',
			warn: 'text-amber-600/80',
			info: 'text-primary/80',
			debug: 'text-muted-foreground/85',
			trace: 'text-muted-foreground/65',
			unknown: 'text-muted-foreground/80'
		}[severity]
	);
</script>

<div class={cn('mt-0.5 mr-3 flex w-16 shrink-0 items-center gap-1.5 uppercase', severityClasses)}>
	<span class="size-2 shrink-0 rounded-full bg-current"></span>
	<span class="w-12 shrink-0 text-xs font-normal" title={severityText}>
		{severity}
	</span>
</div>
