import {
  createDefaultMetricsTimeFilter,
  resolveMetricsStateFromSearchParams,
} from "./state";
import type { LayoutServerLoad } from "./$types";

export const load = (async ({ locals, params, url }) => {
  const state = resolveMetricsStateFromSearchParams(
    url.searchParams,
    createDefaultMetricsTimeFilter(),
  );
  const result = await locals.container.metricsService.getMetricCatalog(
    {
      time: state.time,
      search: state.search,
      limit: 100,
    },
    { appId: params.app_id },
  );

  return {
    time: state.time,
    search: state.search,
    live: state.live,
    aggregation: state.aggregation,
    catalog: result.success ? result.data.catalog : [],
    error: result.success ? "" : result.error,
  };
}) satisfies LayoutServerLoad;
