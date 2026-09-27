import { env } from "$env/dynamic/private";
import { verifySlackSignature } from "$lib/server/services/slack-integration/shared";
import { enqueueSlackScoutRun } from "$lib/server/workers";
import type { RequestHandler } from "./$types";

export const POST = (async (event) => {
  const rawBody = await event.request.text();
  if (
    !verifySlackSignature({
      rawBody,
      timestamp: event.request.headers.get("x-slack-request-timestamp"),
      signature: event.request.headers.get("x-slack-signature"),
      signingSecret: env.SLACK_SIGNING_SECRET ?? "",
    })
  ) {
    return new Response("Invalid Slack signature.", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid Slack payload.", { status: 400 });
  }

  if (
    payload &&
    typeof payload === "object" &&
    "type" in payload &&
    payload.type === "url_verification" &&
    "challenge" in payload &&
    typeof payload.challenge === "string"
  ) {
    return Response.json({ challenge: payload.challenge });
  }

  const result =
    await event.locals.container.slackIntegrationService.ingestEvent(payload);
  if (!result.success) {
    return new Response(result.error, { status: 400 });
  }
  if (result.data.queued) {
    await enqueueSlackScoutRun({
      kind: "message",
      eventId: result.data.eventId,
    });
  }

  return new Response(null, { status: 200 });
}) satisfies RequestHandler;
