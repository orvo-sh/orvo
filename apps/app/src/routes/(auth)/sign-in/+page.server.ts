import { getFriendlyAuthErrorMessage } from "$lib/auth-errors";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
  const code = event.url.searchParams.get("error");
  const description = event.url.searchParams.get("error_description");

  return {
    error: code
      ? (getFriendlyAuthErrorMessage(code) ??
        description ??
        "Unable to continue with GitHub right now. Please try again.")
      : "",
  };
}) satisfies PageServerLoad;
