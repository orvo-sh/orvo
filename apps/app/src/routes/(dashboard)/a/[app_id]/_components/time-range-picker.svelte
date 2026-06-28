<script lang="ts">
  import {
    timePresetLabels,
    type TimeFilter,
    type TimeFilterPreset,
  } from "$lib/core/time-filter";
  import {
    fromDate,
    getLocalTimeZone,
    today,
    type DateValue,
  } from "@internationalized/date";
  import { Button, buttonVariants } from "@repo/components/ui/button";
  import { Input } from "@repo/components/ui/input";
  import { Label } from "@repo/components/ui/label";
  import * as Popover from "@repo/components/ui/popover";
  import * as RangeCalendar from "@repo/components/ui/range-calendar";
  import { toast } from "@repo/components/ui/sonner";
  import {
    IconChevronDown as CaretDownIcon,
    IconCalendarWeek,
    IconChevronRight,
  } from "@tabler/icons-svelte";

  let {
    time = $bindable(),
    onApply,
  }: {
    time?: TimeFilter;
    onApply?: (time: TimeFilter) => void;
  } = $props();

  let internalTime = $state<TimeFilter | undefined>(time);
  let clockTime = $state<{
    start: string;
    end: string;
  }>({ start: "00:00:00", end: "23:59:59" });
  let calendarRange = $state<{
    start: DateValue | undefined;
    end: DateValue | undefined;
  }>({ start: undefined, end: undefined });

  let open = $state(false);

  const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

  const applyClockTime = (dateValue: DateValue, timeValue: string) => {
    const date = dateValue.toDate(getLocalTimeZone());
    const [hours = 0, minutes = 0, seconds = 0] = timeValue
      .split(":")
      .map(Number);
    date.setHours(hours, minutes, seconds, 0);
    return date;
  };

  const apply = () => {
    if (internalTime?.kind === "preset") {
      time = internalTime;
      onApply?.(time);
    } else if (calendarRange.start && calendarRange.end) {
      const start = applyClockTime(calendarRange.start, clockTime.start);
      const end = applyClockTime(calendarRange.end, clockTime.end);

      if (start >= end) {
        toast.error(
          "Start date and time must be earlier than end date and time.",
        );
        return;
      }

      time = {
        kind: "range",
        start: start.toISOString(),
        end: end.toISOString(),
      };
      onApply?.(time);
    }
    open = false;
  };

  $effect(() => {
    if (!open) {
      if (time?.kind === "preset") {
        internalTime = time;
        calendarRange = { start: undefined, end: undefined };
      } else if (time?.kind === "range") {
        const start = new Date(time.start);
        const end = new Date(time.end);

        internalTime = time;
        if (isValidDate(start) && isValidDate(end)) {
          calendarRange = {
            start: fromDate(start, getLocalTimeZone()),
            end: fromDate(end, getLocalTimeZone()),
          };
          clockTime.start = start.toLocaleTimeString("en-GB", {
            hour12: false,
          });
          clockTime.end = end.toLocaleTimeString("en-GB", { hour12: false });
        } else {
          calendarRange = { start: undefined, end: undefined };
          clockTime = { start: "00:00:00", end: "23:59:59" };
        }
      } else {
        internalTime = undefined;
        calendarRange = { start: undefined, end: undefined };
        clockTime = { start: "00:00:00", end: "23:59:59" };
      }
    }
  });
</script>

<Popover.Root bind:open>
  <Popover.Trigger class={buttonVariants({ variant: "outline" })}>
    <IconCalendarWeek class="not-md:hidden" />
    {@const t = (() => {
      if (time?.kind === "preset")
        return { type: "preset" as "preset", ...timePresetLabels[time.preset] };

      const fmt = (d: Date) =>
        d.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "2-digit",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      const start = time ? new Date(time.start) : null;
      const end = time ? new Date(time.end) : null;
      if (!start || !end || !isValidDate(start) || !isValidDate(end)) {
        return { type: "preset", ...timePresetLabels["last_hour"] };
      }
      return { type: "range" as "range", start: fmt(start), end: fmt(end) };
    })()}
    <span class="flex items-center gap-1.5 text-foreground">
      {#if t.type === "preset"}
        <span class="md:hidden">{t.short}</span>
        <span class="not-md:hidden">
          {t.full}
        </span>
      {:else}
        {t.start}
        <IconChevronRight class="size-3 text-muted-foreground" />
        {t.end}
      {/if}
    </span>
    <CaretDownIcon class="ml-0.5 size-3 text-muted-foreground" />
  </Popover.Trigger>

  <Popover.Content
    class="w-auto overflow-hidden p-0"
    align="end"
    side="bottom"
    sideOffset={9}
  >
    <div class="flex">
      <div class="flex min-w-36 flex-col gap-0.5 border-r p-1 md:p-2">
        {#each Object.entries(timePresetLabels) as [key, value]}
          <Button
            variant="ghost"
            onclick={() => {
              internalTime = {
                kind: "preset",
                preset: key as TimeFilterPreset,
              };
              calendarRange = { start: undefined, end: undefined };
            }}
            class="justify-start text-left
							{internalTime?.kind === 'preset' && internalTime.preset === key
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
          >
            {value.full}
          </Button>
        {/each}
      </div>

      <div class="flex flex-col not-md:hidden">
        <RangeCalendar.RangeCalendar
          numberOfMonths={2}
          maxValue={today(getLocalTimeZone())}
          bind:value={calendarRange}
          weekdayFormat="short"
          class="p-3"
          onValueChange={(e) => {
            if (e.start && e.end)
              internalTime = {
                kind: "range",
                start: e.start.toDate(getLocalTimeZone()).toISOString(),
                end: e.end.toDate(getLocalTimeZone()).toISOString(),
              };
          }}
        />

        <div
          class="flex flex-col items-center justify-between gap-4 border-t p-3 pt-4"
        >
          <div class="flex w-full items-center gap-3">
            <div class="flex w-full flex-col gap-1.5">
              <Label class="ml-1 text-secondary-foreground">Start</Label>
              <Input
                type="time"
                class="w-full"
                step="1"
                bind:value={clockTime.start}
              />
            </div>
            <span
              class="mt-5 flex h-full items-center text-xs text-muted-foreground"
            >
              <IconChevronRight class="size-3" />
            </span>
            <div class="flex w-full flex-col gap-1.5">
              <Label class="ml-1 text-secondary-foreground">End</Label>
              <Input
                type="time"
                class="w-full"
                step="1"
                bind:value={clockTime.end}
              />
            </div>
          </div>

          <div class="flex w-full justify-end gap-2">
            <Button
              variant="outline"
              onclick={() => {
                open = false;
              }}
            >
              Close
            </Button>
            <Button onclick={apply}>Apply</Button>
          </div>
        </div>
      </div>
    </div>
  </Popover.Content>
</Popover.Root>
