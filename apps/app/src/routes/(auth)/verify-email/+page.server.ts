import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
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
    email: event.url.searchParams.get("email") || "",
  };
}) satisfies PageServerLoad;
