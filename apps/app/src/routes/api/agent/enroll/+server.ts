import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST = (async ({ locals, request }) => {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json(
      { error: "The request body must be valid JSON." },
      { status: 400 },
    );
  }

  const result = await locals.container.agentService.redeemEnrollment(input);
  if (!result.success) {
    return json({ error: result.error }, { status: 400 });
  }

  return json(result.data);
}) satisfies RequestHandler;
