import {
  createDefaultMetricsTimeFilter,
  decodeMetricName,
  resolveDefaultMetricAggregation,
  resolveMetricAggregationOptions,
  resolveMetricsBucketCount,
  resolveMetricsStateFromSearchParams,
} from "../state";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params, parent, url }) => {
  const parentData = await parent();
  const state = resolveMetricsStateFromSearchParams(
    url.searchParams,
    createDefaultMetricsTimeFilter(),
  );
  const metricName = decodeMetricName(params.metric_name);
  let selectedMetric =
    parentData.catalog.find((metric) => metric.name === metricName) ?? null;
  let aggregation =
    state.aggregation ??
    (selectedMetric ? resolveDefaultMetricAggregation(selectedMetric) : "avg");

  if (
    selectedMetric &&
    !resolveMetricAggregationOptions(selectedMetric).some(
      (option) => option.value === aggregation,
    )
  ) {
    aggregation = resolveDefaultMetricAggregation(selectedMetric);
  }

  const loadMetric = async (nextAggregation: typeof aggregation) =>
    locals.container.metricsService.getMetricsExplorer(
      {
        time: state.time,
        search: "",
        metricName,
        services: [],
        environments: [],
        hosts: [],
        containers: [],
        entityKinds: [],
        aggregation: nextAggregation,
        groupBy: "service",
        bucketCount: resolveMetricsBucketCount(state.time),
        sampleLimit: 50,
      },
      { appId: params.app_id },
    );

  let result = await loadMetric(aggregation);

  if (result.success && result.data.catalog.length > 0) {
    selectedMetric = result.data.catalog[0];
    if (
      !resolveMetricAggregationOptions(selectedMetric).some(
        (option) => option.value === aggregation,
      )
    ) {
      aggregation = resolveDefaultMetricAggregation(selectedMetric);
      result = await loadMetric(aggregation);
      if (result.success && result.data.catalog.length > 0) {
        selectedMetric = result.data.catalog[0];
      }
    }
  }

  return {
    time: state.time,
    live: state.live,
    search: state.search,
    metricName,
    selectedMetric,
    aggregation,
    aggregationOptions: resolveMetricAggregationOptions(selectedMetric),
    metricsResult: result,
  };
}) satisfies PageServerLoad;
