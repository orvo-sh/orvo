<script lang="ts">
	import {
	    fromDate,
	    getLocalTimeZone,
	    today,

	    type DateValue
	} from '@internationalized/date';
	import { Button, buttonVariants } from '@repo/components/ui/button';
	import { Input } from '@repo/components/ui/input';
	import { Label } from '@repo/components/ui/label';
	import * as Popover from '@repo/components/ui/popover';
	import * as RangeCalendar from '@repo/components/ui/range-calendar';
	import { toast } from '@repo/components/ui/sonner';
	import {
	    IconChevronDown as CaretDownIcon,
	    IconCalendarWeek,
	    IconChevronRight
	} from "@tabler/icons-svelte";
	import type { LogTimeFilter, LogTimePreset } from '../types';

	const PRESET_OPTIONS = [
		{ value: 'last_hour', label: 'Last hour' },
		{ value: 'today', label: 'Today' },
		{ value: 'last_24_hours', label: 'Last 24 hours' },
		{ value: 'last_3_days', label: 'Last 3 days' },
		{ value: 'last_7_days', label: 'Last 7 days' },
		{ value: 'last_2_weeks', label: 'Last 2 weeks' },
		{ value: 'last_month', label: 'Last month' }
	] satisfies { value: LogTimePreset; label: string }[];

	let {
		time = $bindable(),
	}: {
		time?: LogTimeFilter;
	} = $props();

	let internalTime = $state<LogTimeFilter | undefined>(time);
	let clockTime = $state<{
		start: string;
		end: string;
	}>({ start: '00:00:00', end: '23:59:59' });
	let calendarRange = $state<{
    	start: DateValue | undefined;
    	end: DateValue | undefined;
	}>({start: undefined, end: undefined});


	let open = $state(false);

	const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

	const applyClockTime = (dateValue: DateValue, timeValue: string) => {
		const date = dateValue.toDate(getLocalTimeZone());
		const [hours = 0, minutes = 0, seconds = 0] = timeValue.split(':').map(Number);
		date.setHours(hours, minutes, seconds, 0);
		return date;
	};

	const apply = () => {
		if (internalTime?.kind === 'preset') {
			time = internalTime;
		} else if (calendarRange.start && calendarRange.end) {
			const start = applyClockTime(calendarRange.start, clockTime.start);
			const end = applyClockTime(calendarRange.end, clockTime.end);

			if (start >= end) {
				toast.error('Start date and time must be earlier than end date and time.');
				return;
			}

			time = {
				kind: 'range',
				startAtUtc: start.toISOString(),
				endAtUtc: end.toISOString()
			};
		}
		open = false;
	};

	$effect(()=>{
		if (!open) {
			if (time?.kind === 'preset') {
				internalTime = time;
				calendarRange = { start: undefined, end: undefined };
			} else if (time?.kind === 'range') {
				const start = new Date(time.startAtUtc);
				const end = new Date(time.endAtUtc);

				internalTime = time;
				if (isValidDate(start) && isValidDate(end)) {
					calendarRange = {
						start: fromDate(start, getLocalTimeZone()),
						end: fromDate(end, getLocalTimeZone())
					};
					clockTime.start = start.toLocaleTimeString('en-GB', { hour12: false });
					clockTime.end = end.toLocaleTimeString('en-GB', { hour12: false });
				} else {
					calendarRange = { start: undefined, end: undefined };
					clockTime = { start: '00:00:00', end: '23:59:59' };
				}
			} else {
				internalTime = undefined;
				calendarRange = { start: undefined, end: undefined };
				clockTime = { start: '00:00:00', end: '23:59:59' };
			}
		}
	})
</script>

<Popover.Root bind:open>
	<Popover.Trigger class={buttonVariants({variant:"outline",})}>
		<IconCalendarWeek />
		{@const t = (()=>{
			if (time?.kind === 'preset') {
				const p = time.preset
				return PRESET_OPTIONS.find((option) => option.value === p)?.label ?? 'Last hour'
			};
		
			const fmt = (d: Date) =>
				d.toLocaleString('en-US', {
					month: 'short',
					day: 'numeric',
					year: '2-digit',
					hour: 'numeric',
					minute: '2-digit',
					hour12: true
				});
			const start = time ? new Date(time.startAtUtc) : null;
			const end = time ? new Date(time.endAtUtc) : null;
			if (!start || !end || !isValidDate(start) || !isValidDate(end)) {
				return 'Last hour';
			}
			return {start:fmt(start), end: fmt(end)}
		})()}
		<span class="text-foreground flex items-center gap-1.5">
			{#if typeof t == "string"}
				{t}
			{:else}
				{t.start} <IconChevronRight class="size-3 text-muted-foreground"/> {t.end}
			{/if}
			</span>
		<CaretDownIcon class="size-3 text-muted-foreground ml-0.5" />		
	</Popover.Trigger>

	<Popover.Content class="w-auto p-0 overflow-hidden" align="start">
		<div class="flex">
			<div class="flex flex-col gap-0.5 border-r p-2 min-w-36">
				{#each PRESET_OPTIONS as preset}
					<Button
						variant="ghost"
						onclick={() => {
							internalTime = { kind: 'preset', preset: preset.value };
							calendarRange = { start: undefined, end: undefined };
						}}
						class="text-left justify-start
							{internalTime?.kind === 'preset' && internalTime.preset === preset.value
							? 'bg-muted text-foreground'
							: 'text-muted-foreground hover:text-foreground hover:bg-muted'}"
					>
						{preset.label}
					</Button>
				{/each}
			</div>

			<div class="flex flex-col">
				<RangeCalendar.RangeCalendar
					numberOfMonths={2}
					maxValue={today(getLocalTimeZone())}
					bind:value={calendarRange}
					weekdayFormat="short"
					class="p-3"
					onValueChange={(e) => {
						if (e.start && e.end)  
						internalTime = {
							kind: 'range',
							startAtUtc: e.start.toDate(getLocalTimeZone()).toISOString(),
							endAtUtc: e.end.toDate(getLocalTimeZone()).toISOString()
						};
					}}
				/>

				<div class="border-t p-3 pt-4 flex flex-col items-center justify-between gap-4">
					<div class="flex items-center gap-3 w-full">
						<div class="flex flex-col w-full gap-1.5">
							<Label class="ml-1 text-secondary-foreground" >Start</Label>
							<Input
								type="time"
								class="w-full"
								step="1"
								bind:value={clockTime.start}
							/>
						</div>
						<span class="text-muted-foreground text-xs h-full items-center flex mt-5">
							<IconChevronRight class="size-3" />
						</span>
						<div class="flex flex-col w-full gap-1.5">
							<Label class="ml-1 text-secondary-foreground" >End</Label>
							<Input
								type="time"
								class="w-full"
								step="1"
								bind:value={clockTime.end}
							/>
						</div>
					</div>

					<div class="flex justify-end gap-2 w-full">
						<Button variant="outline" onclick={()=>{open=false}}>
							Close
						</Button>
						<Button onclick={apply} >Apply</Button>
					</div>
				</div>
			</div>
		</div>
	</Popover.Content>
</Popover.Root>
