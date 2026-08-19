import { resolveThemeMode, themeModeCookieName } from "$lib/theme/theme";
import { mode } from "$lib/server/mode";
import type { LayoutServerLoad } from "./$types";

export const load = (({ cookies }) => {
  return {
    themeMode: resolveThemeMode(cookies.get(themeModeCookieName)),
    mode,
  };
}) satisfies LayoutServerLoad;
