import type { RequestHandler } from "@sveltejs/kit";

export const GET = (async ({ locals, params }) => {
  if (!params.token) {
    return new Response("Missing install token.", { status: 400 });
  }

  const result = await locals.container.hostMonitoringService.getInstallBundle({
    token: params.token,
  });

  if (!result.success) {
    return new Response(result.error, { status: 400 });
  }

  return new Response(result.data.content, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": result.data.contentType,
    },
  });
}) satisfies RequestHandler;
