import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import {
  createLogsServiceInput,
  resolveLogStateFromSearchParams,
  resolveLogTimeRange,
  resolveLogVolumeBucketCount,
} from "./state";

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const state = resolveLogStateFromSearchParams(url.searchParams);
  const timeRange = resolveLogTimeRange(state.time);
  const serviceInput = createLogsServiceInput(state.time, state.filters);
  const [logsResult, volumeResult, filterAttributesResult] = await Promise.all([
    locals.container.logsService.getLogs(
      {
        ...serviceInput,
        limit: 250,
      },
      { appId: params.app_id },
    ),
    locals.container.logsService.getLogVolume(
      {
        ...serviceInput,
        bucketCount: resolveLogVolumeBucketCount(timeRange.start, timeRange.end),
      },
      { appId: params.app_id },
    ),
    locals.container.logsService.getLogFilterAttributes({
      appId: params.app_id,
    }),
  ]);

  if (!logsResult.success) {
    throw error(500, logsResult.error);
  }

  if (!volumeResult.success) {
    throw error(500, volumeResult.error);
  }

  if (!filterAttributesResult.success) {
    throw error(500, filterAttributesResult.error);
  }

  const logs = logsResult.data.logs;
  const selectedLog =
    state.selectedLogId === null
      ? null
      : (logs.find((log) => log.id === state.selectedLogId) ?? null);
  const selectedLogResult =
    state.selectedLogId !== null && selectedLog === null
      ? await locals.container.logsService.getLogById(
          { id: state.selectedLogId },
          { appId: params.app_id },
        )
      : null;

  return {
    live: state.live,
    selectedLogId: state.selectedLogId,
    time: state.time,
    filters: state.filters,
    logs,
    selectedLog:
      selectedLog ??
      (selectedLogResult?.success ? selectedLogResult.data.log : null),
    volumeBuckets: volumeResult.data.buckets,
    filterAttributes: filterAttributesResult.data.attributes,
    error: "",
  };
};
