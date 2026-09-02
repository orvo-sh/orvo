import { env } from "$env/dynamic/private";
import { verifySlackSignature } from "$lib/server/services/slack-integration/shared";
import type { RequestHandler } from "./$types";

export const POST = (async (event) => {
  const rawBody = await event.request.text();
  const valid = verifySlackSignature({
    rawBody,
    timestamp: event.request.headers.get("x-slack-request-timestamp"),
    signature: event.request.headers.get("x-slack-signature"),
    signingSecret: env.SLACK_SIGNING_SECRET ?? "",
  });

  if (!valid) return new Response("Invalid Slack signature.", { status: 401 });

  const encodedPayload = new URLSearchParams(rawBody).get("payload");
  if (!encodedPayload)
    return new Response("Invalid Slack payload.", { status: 400 });

  let payload: unknown;
  try {
    payload = JSON.parse(encodedPayload);
  } catch {
    return new Response("Invalid Slack payload.", { status: 400 });
  }

  const result =
    await event.locals.container.slackIntegrationService.processAction(payload);
  if (!result.success) {
    return Response.json({
      response_type: "ephemeral",
      replace_original: false,
      text: result.error,
    });
  }

  if (
    result.data.responseUrl &&
    result.data.responseUrl.startsWith("https://hooks.slack.com/actions/")
  ) {
    await fetch(result.data.responseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(2_000),
      body: JSON.stringify({
        replace_original: true,
        text: ":white_check_mark: Incident resolved in Orvo.",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: ":white_check_mark: *Incident resolved in Orvo*",
            },
          },
        ],
      }),
    }).catch(() => undefined);
  }

  return new Response(null, { status: 200 });
}) satisfies RequestHandler;
