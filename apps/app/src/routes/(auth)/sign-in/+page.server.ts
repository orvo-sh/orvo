import { getFriendlyAuthErrorMessage } from "$lib/auth-errors";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
  const code = event.url.searchParams.get("error");
  const description = event.url.searchParams.get("error_description");
  const fallbackCallback = "/";
  const rawCallback = event.url.searchParams.get("callback");

  let callback = fallbackCallback;

  if (rawCallback) {
    try {
      const callbackUrl = new URL(rawCallback, event.url.origin);

      if (callbackUrl.origin === event.url.origin) {
        callback = `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`;
      }
    } catch {
      callback = fallbackCallback;
    }
  }

  return {
    callback,
    error: code
      ? (getFriendlyAuthErrorMessage(code) ??
        description ??
        "Unable to continue with GitHub right now. Please try again.")
      : "",
  };
}) satisfies PageServerLoad;
