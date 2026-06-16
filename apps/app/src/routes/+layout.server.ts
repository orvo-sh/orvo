import { resolveThemeMode, themeModeCookieName } from "$lib/theme/theme";
import type { LayoutServerLoad } from "./$types";

export const load = (({ cookies }) => {
  return {
    themeMode: resolveThemeMode(cookies.get(themeModeCookieName)),
  };
}) satisfies LayoutServerLoad;
