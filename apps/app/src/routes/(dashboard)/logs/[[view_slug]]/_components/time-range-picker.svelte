<script lang="ts">
	import {
	    CalendarDate,
	    type DateValue,
	    getLocalTimeZone,
	    today
	} from '@internationalized/date';
	import { Button } from '@repo/components/ui/button';
	import { Input } from '@repo/components/ui/input';
	import { Label } from '@repo/components/ui/label';
	import * as Popover from '@repo/components/ui/popover';
	import * as RangeCalendar from '@repo/components/ui/range-calendar';
	import {
		IconCalendar as CalendarBlankIcon,
		IconChevronDown as CaretDownIcon,
		IconX as XIcon
	} from "@tabler/icons-svelte";

	type Preset = {
		label: string;
		resolve: () => { start: Date; end: Date };
	};

	type DateRange = {
		start: DateValue | undefined;
		end: DateValue | undefined;
	};

	const PRESETS: Preset[] = [
		{ label: 'Last hour', resolve: () => ({ start: relative(-60), end: new Date() }) },
		{ label: 'Today', resolve: () => ({ start: startOf('day'), end: new Date() }) },
		{ label: 'Last 24 hours', resolve: () => ({ start: relative(-60 * 24), end: new Date() }) },
		{ label: 'Last 3 days', resolve: () => ({ start: relative(-60 * 24 * 3), end: new Date() }) },
		{
			label: 'Last 7 days',
			resolve: () => ({ start: relative(-60 * 24 * 7), end: new Date() })
		},
		{
			label: 'Last 2 weeks',
			resolve: () => ({ start: relative(-60 * 24 * 14), end: new Date() })
		},
		{
			label: 'Last month',
			resolve: () => ({ start: relative(-60 * 24 * 30), end: new Date() })
		}
	];

	function relative(minutes: number): Date {
		return new Date(Date.now() + minutes * 60 * 1000);
	}

	function startOf(unit: 'day'): Date {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	}

	function toCalendarDate(d: Date): CalendarDate {
		return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
	}

	function formatTime(d: Date): string {
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
	}

	function formatLabel(start: Date, end: Date): string {
		const fmt = (d: Date) =>
			d.toLocaleString('en-US', {
				month: 'short',
				day: 'numeric',
				year: '2-digit',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});
		return `${fmt(start)} → ${fmt(end)}`;
	}

	function applyDateRange(range: DateRange, startTime: string, endTime: string): { start: Date; end: Date } | null {
		if (!range.start || !range.end) return null;

		const tz = getLocalTimeZone();
		const startDate = range.start.toDate(tz);
		const endDate = range.end.toDate(tz);

		const [sh, sm, ss] = startTime.split(':').map(Number);
		const [eh, em, es] = endTime.split(':').map(Number);

		startDate.setHours(sh ?? 0, sm ?? 0, ss ?? 0, 0);
		endDate.setHours(eh ?? 23, em ?? 59, es ?? 59, 999);

		return { start: startDate, end: endDate };
	}

	let {
		start = $bindable<Date>(),
		end = $bindable<Date>()
	}: {
		start?: Date;
		end?: Date;
	} = $props();

	const defaultEnd = new Date();
	const defaultStart = relative(-60 * 10);

	let open = $state(false);

	let calRange = $state<DateRange>({
		start: toCalendarDate(start ?? defaultStart),
		end: toCalendarDate(end ?? defaultEnd)
	});
	let startTime = $state(formatTime(start ?? defaultStart));
	let endTime = $state(formatTime(end ?? defaultEnd));
	let activePreset = $state<string | null>('Last hour');

	const label = $derived(formatLabel(start ?? defaultStart, end ?? defaultEnd));

	function applyPreset(preset: Preset) {
		const { start: s, end: e } = preset.resolve();
		calRange = { start: toCalendarDate(s), end: toCalendarDate(e) };
		startTime = formatTime(s);
		endTime = formatTime(e);
		activePreset = preset.label;
	}

	function apply() {
		const result = applyDateRange(calRange, startTime, endTime);
		if (!result) return;
		start = result.start;
		end = result.end;
		open = false;
	}

	function reset() {
		applyPreset(PRESETS[0]);
		const { start: s, end: e } = PRESETS[0].resolve();
		start = s;
		end = e;
		open = false;
	}

	$effect(() => {
		if (!open) return;
		calRange = {
			start: toCalendarDate(start ?? defaultStart),
			end: toCalendarDate(end ?? defaultEnd)
		};
		startTime = formatTime(start ?? defaultStart);
		endTime = formatTime(end ?? defaultEnd);
	});
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button variant="outline" class="gap-1.5 font-normal text-sm h-8 px-3" {...props}>
				<CalendarBlankIcon class="size-3.5 text-muted-foreground" />
				<span class="text-foreground">{label}</span>
				<CaretDownIcon class="size-3 text-muted-foreground ml-0.5" />
			</Button>
		{/snippet}
	</Popover.Trigger>

	<Popover.Content class="w-auto p-0 overflow-hidden" align="start">
		<div class="flex">
			<!-- Preset sidebar -->
			<div class="flex flex-col gap-0.5 border-r px-2 py-3 min-w-36">
				{#each PRESETS as preset}
					<button
						class="text-left text-sm px-2.5 py-1.5 rounded-md transition-colors
							{activePreset === preset.label
							? 'bg-muted text-foreground font-medium'
							: 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}"
						onclick={() => applyPreset(preset)}
					>
						{preset.label}
					</button>
				{/each}
			</div>

			<!-- Calendar -->
			<div class="flex flex-col">
				<RangeCalendar.RangeCalendar
					bind:value={calRange}
					numberOfMonths={2}
					maxValue={today(getLocalTimeZone())}
					weekdayFormat="short"
					class="p-3"
					onValueChange={() => (activePreset = null)}
				/>

				<!-- Time inputs + actions -->
				<div class="border-t px-4 py-3 flex items-center justify-between gap-4">
					<div class="flex items-center gap-3">
						<div class="flex items-center gap-1.5">
							<Label class="text-xs text-muted-foreground shrink-0">Start time</Label>
							<Input
								type="time"
								step="1"
								bind:value={startTime}
								class="h-7 text-xs w-28 text-center [&::-webkit-calendar-picker-indicator]:hidden appearance-none"
							/>
						</div>
						<span class="text-muted-foreground text-xs">→</span>
						<div class="flex items-center gap-1.5">
							<Label class="text-xs text-muted-foreground shrink-0">End time</Label>
							<Input
								type="time"
								step="1"
								bind:value={endTime}
								class="h-7 text-xs w-28 text-center [&::-webkit-calendar-picker-indicator]:hidden appearance-none"
							/>
						</div>
					</div>

					<div class="flex items-center gap-2">
						<button
							class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
							onclick={reset}
						>
							<XIcon class="size-3" />
							Reset dates
						</button>
						<Button size="sm" class="h-7 text-xs px-3" onclick={apply}>Apply</Button>
					</div>
				</div>
			</div>
		</div>
	</Popover.Content>
</Popover.Root>
