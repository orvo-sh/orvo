import { logTimePresetSchema } from "$lib/server/services/logs.service";
import type { PageServerLoad } from "./$types";

export const load = (async ({ url, locals, params }) => {
  const appId = params.app_id;

  const rawPreset = url.searchParams.get("t");
  const selectedService = url.searchParams.get("service")?.trim() ?? "";
  const parsedPreset = logTimePresetSchema.safeParse(rawPreset);
  const timePreset = parsedPreset.success ? parsedPreset.data : "last_hour";
  const timeFilter = { kind: "preset" as const, preset: timePreset };

  const graphResult = await locals.container.tracesService.getServiceGraph(
    { time: timeFilter },
    { appId },
  );

  return {
    appId,
    timePreset,
    selectedService,
    graph: graphResult.success ? graphResult.data : null,
  };
}) satisfies PageServerLoad;
