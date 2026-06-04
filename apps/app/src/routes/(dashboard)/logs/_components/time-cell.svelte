<script lang="ts">
	let {
		date,
		range
	}: {
		date: Date;
		range: {
			start: Date;
			end: Date;
		};
	} = $props();

	const monthRangeFormatter = $derived(
		new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: '2-digit'
		})
	);
	const dayRangeFormatter = $derived(
		new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		})
	);
	const timestampFormatter = $derived(
		new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			fractionalSecondDigits: 3,
			hour12: false
		})
	);
	const timestampParts = $derived(timestampFormatter.formatToParts(date));
	const month = $derived(
		timestampParts.find((part) => part.type === 'month')?.value.toUpperCase() ?? '---'
	);
	const day = $derived(timestampParts.find((part) => part.type === 'day')?.value ?? '00');
	const hour = $derived(timestampParts.find((part) => part.type === 'hour')?.value ?? '00');
	const minute = $derived(timestampParts.find((part) => part.type === 'minute')?.value ?? '00');
	const second = $derived(timestampParts.find((part) => part.type === 'second')?.value ?? '00');
	const fractionalSecond = $derived(
		(timestampParts.find((part) => part.type === 'fractionalSecond')?.value ?? '000').slice(0, 2)
	);
	const rangeSpansMonth = $derived(
		monthRangeFormatter.format(range.start) !== monthRangeFormatter.format(range.end)
	);
	const rangeSpansDay = $derived(
		dayRangeFormatter.format(range.start) !== dayRangeFormatter.format(range.end)
	);
</script>

{#if rangeSpansMonth}
	<span class="text-secondary-foreground">{month} {day} {hour}:{minute}:{second}</span>
	<span class="text-secondary-foreground">.{fractionalSecond}</span>
{:else if rangeSpansDay}
	<span class="text-muted-foreground">{month} </span>
	<span class="text-secondary-foreground">{day} {hour}:{minute}:{second}</span>
	<span class="text-secondary-foreground">.{fractionalSecond}</span>
{:else}
	<span class="text-muted-foreground mr-1.5">{month} {day}</span>
	<span class="text-secondary-foreground">{hour}:{minute}:{second}</span>
	<span class="text-secondary-foreground">.{fractionalSecond}</span>
{/if}
