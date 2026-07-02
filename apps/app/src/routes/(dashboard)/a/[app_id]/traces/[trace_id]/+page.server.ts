import { error } from "@sveltejs/kit";

export const load = (async ({ depends, locals, params }) => {
  depends(`app:trace:${params.app_id}:${params.trace_id}`);

  const result = await locals.container.tracesService.getTrace(
    { id: params.trace_id },
    { appId: params.app_id },
  );

  if (!result.success) throw error(500, result.error);

  return {
    spans: result.data.spans,
  };
});
