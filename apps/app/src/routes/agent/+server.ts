import { env } from "$env/dynamic/private";
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET = (() => {
  redirect(307, new URL("/agent/install.sh", env.CDN_BASE_URL).toString());
}) satisfies RequestHandler;
