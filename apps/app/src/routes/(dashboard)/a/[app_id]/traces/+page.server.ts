import {
  createDefaultTraceFilters,
  createDefaultTraceTimeFilter,
  createTraceServiceInput,
  resolveTraceStateFromSearchParams,
} from "./state";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params, url }) => {
  const state = resolveTraceStateFromSearchParams(
    url.searchParams,
    createDefaultTraceTimeFilter(),
    createDefaultTraceFilters(),
  );
  const [result, filterAttributesResult] = await Promise.all([
    locals.container.tracesService.getTraces(
      {
        ...createTraceServiceInput(state.time, state.filters),
        limit: 250,
      },
      { appId: params.app_id },
    ),
    locals.container.tracesService.getTraceFilterAttributes({
      appId: params.app_id,
    }),
  ]);

  return {
    time: state.time,
    filters: state.filters,
    traces: result.success ? result.data.traces : [],
    filterAttributes: filterAttributesResult.success
      ? filterAttributesResult.data.attributes
      : [],
    error: result.success ? "" : result.error,
  };
}) satisfies PageServerLoad;
