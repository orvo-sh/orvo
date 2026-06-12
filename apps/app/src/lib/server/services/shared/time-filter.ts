import { z } from "zod";

const timeFilterPresetEnum = z.enum([
    "last_30_minutes",
    "last_hour",
    "today",
    "last_4_hours",
    "last_24_hours",
    "last_3_days",
    "last_7_days",
    "last_2_weeks",
    "last_month",
    ]);

const timeFilterSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("preset"),
    preset: timeFilterPresetEnum,
  }),
  z
    .object({
      kind: z.literal("range"),
      startAtUtc: z.iso.datetime({ offset: true }),
      endAtUtc: z.iso.datetime({ offset: true }),
    })
    .refine(
      (value) =>
        new Date(value.startAtUtc).getTime() <=
        new Date(value.endAtUtc).getTime(),
      {
        message: "startAtUtc must be less than or equal to endAtUtc",
        path: ["endAtUtc"],
      },
    ),
]);

type TimeFilter = z.infer<typeof timeFilterSchema>;
type TimeFilterPreset = z.infer<typeof timeFilterPresetEnum>;

const resolveTimeFilter = (timeFilter: TimeFilter) => {
  const endAtUtc = new Date();

  if (timeFilter.kind === "range") 
    return {
      startAtUtc: new Date(timeFilter.startAtUtc),
      endAtUtc: new Date(timeFilter.endAtUtc),
    };
  
  if (timeFilter.preset === "today") {
    const startAtToday = new Date(endAtUtc);
    startAtToday.setUTCHours(0, 0, 0, 0);
    return {
      startAtUtc: startAtToday,
      endAtUtc,
    };
  }

  const presetMinutesMap: Record<TimeFilterPreset, number> =
    {
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
    startAtUtc: new Date(
      endAtUtc.getTime() - presetMinutesMap[timeFilter.preset] * 60 * 1000,
    ),
    endAtUtc,
  };
};


export { resolveTimeFilter, timeFilterSchema, type TimeFilter };

