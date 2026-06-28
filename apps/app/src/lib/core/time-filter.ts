import { z } from "zod";

const timeFilterPresets = [
    "last_30_minutes",
    "last_hour",
    "today",
    "last_4_hours",
    "last_24_hours",
    "last_3_days",
    "last_7_days",
    "last_2_weeks",
    "last_month",
] as const;

const timeFilterPresetEnum = z.enum(timeFilterPresets);

const timeFilterSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("preset"),
        preset: timeFilterPresetEnum,
    }),
    z
        .object({
            kind: z.literal("range"),
            start: z.iso.datetime({ offset: true }),
            end: z.iso.datetime({ offset: true }),
        })
        .refine(
            (value) =>
                new Date(value.start).getTime() <=
                new Date(value.end).getTime(),
            {
                message: "startAtUtc must be less than or equal to endAtUtc",
                path: ["endAtUtc"],
            },
        ),
]);

type TimeFilter = z.infer<typeof timeFilterSchema>;
type TimeFilterPreset = z.infer<typeof timeFilterPresetEnum>;

const resolveTimeFilter = (timeFilter: TimeFilter) => {
    const end = new Date();

    if (timeFilter.kind === "range")
        return {
            start: new Date(timeFilter.start),
            end: new Date(timeFilter.end),
        };

    if (timeFilter.preset === "today") {
        const startAtToday = new Date(end);
        startAtToday.setUTCHours(0, 0, 0, 0);
        return {
            start: startAtToday,
            end: end,
        };
    }

    const presetMinutesMap: Record<TimeFilterPreset, number> = {
        last_30_minutes: 30,
        last_hour: 60,
        today: 0,
        last_4_hours: 60 * 4,
        last_24_hours: 60 * 24,
        last_3_days: 60 * 24 * 3,
        last_7_days: 60 * 24 * 7,
        last_2_weeks: 60 * 24 * 14,
        last_month: 60 * 24 * 30,
    };

    return {
        start: new Date(
            end.getTime() - presetMinutesMap[timeFilter.preset] * 60 * 1000,
        ),
        end: end,
    };
};


const timePresetLabels: Record<TimeFilterPreset, { full: string; short: string }> = {
    "last_30_minutes": { full: "Last 30 minutes", short: "30m" },
    "last_hour": { full: "Last hour", short: "1h" },
    "last_4_hours": { full: "Last 4 hours", short: "4h" },
    "today": { full: "Today", short: "today" },
    "last_24_hours": { full: "Last 24 hours", short: "24h" },
    "last_3_days": { full: "Last 3 days", short: "3d" },
    "last_7_days": { full: "Last 7 days", short: "7d" },
    "last_2_weeks": { full: "Last 2 weeks", short: "2w" },
    "last_month": { full: "Last month", short: "1m" },
};

export { resolveTimeFilter, timeFilterPresetEnum, timeFilterPresets, timeFilterSchema, timePresetLabels, type TimeFilter, type TimeFilterPreset };

