import type { LogTimeFilter } from "../types";
import type { PageServerLoad } from "./$types";

export const load = (() => {
  return {
    time: {
      kind: "preset",
      preset: "last_24_hours",
    } as LogTimeFilter,
  };
}) satisfies PageServerLoad;
