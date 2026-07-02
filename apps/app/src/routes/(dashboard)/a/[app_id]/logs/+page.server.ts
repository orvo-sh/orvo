import { resolveTimeFilter } from "$lib/core/time-filter";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import {
  resolveLogStateFromSearchParams,
  resolveLogVolumeBucketCount,
} from "./state";

export const load: PageServerLoad = async ({
  depends,
  locals,
  params,
  url,
}) => {
  depends(`app:logs:${params.app_id}`);

  const state = resolveLogStateFromSearchParams(url.searchParams);
  const timeRange = resolveTimeFilter(state.time);
  const [logsResult, volumeResult, filterAttributesResult] = await Promise.all([
    locals.container.logsService.getLogs(
      {
        time: state.time,
        activeFilters: state.filters.activeFilters,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        limit: 250,
      },
      { appId: params.app_id },
    ),
    locals.container.logsService.getLogVolume(
      {
        time: state.time,
        activeFilters: state.filters.activeFilters,
        bucketCount: resolveLogVolumeBucketCount(
          timeRange.start,
          timeRange.end,
        ),
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

  if (selectedLogResult && !selectedLogResult.success) {
    throw error(500, selectedLogResult.error);
  }

  return {
    live: state.live,
    selectedLogId: state.selectedLogId,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    time: state.time,
    filters: state.filters,
    logs,
    selectedLog: selectedLog ?? selectedLogResult?.data.log ?? null,
    nextCursor: logsResult.data.nextCursor,
    volumeBuckets: volumeResult.data.buckets,
    filterAttributes: filterAttributesResult.data.attributes,
  };
};
