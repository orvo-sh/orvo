import { trace } from "@opentelemetry/api";
import { command, getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";
import { z } from "zod";

const trackAgentSetup = command(z.enum(["clicked", "copied"]), (event) => {
  if (!getRequestEvent().locals.auth) error(401, "Sign in required.");

  const span = trace.getTracer("orvo-app").startSpan("onboarding.agent_setup");
  span.addEvent(`onboarding.agent_setup.${event}`);
  span.end();
});

export { trackAgentSetup };
