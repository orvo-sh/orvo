const themeModes = ["light", "dark"] as const;

type ThemeMode = (typeof themeModes)[number];

const themeModeCookieName = "orvo-theme-mode";

const resolveThemeMode = (value?: string | null): ThemeMode =>
  value === "dark" ? "dark" : "light";

const getThemeCookieValue = (mode: ThemeMode) =>
  `${themeModeCookieName}=${mode}; Path=/; Max-Age=31536000; SameSite=Lax`;

const setThemeMode = (mode: ThemeMode) => {
  document.cookie = `${getThemeCookieValue(mode)}${window.location.protocol === "https:" ? "; Secure" : ""}`;
};

const getThemeDocumentAttributes = (mode: ThemeMode) =>
  mode === "dark"
    ? ' class="dark" style="color-scheme: dark"'
    : ' style="color-scheme: light"';

export {
  getThemeCookieValue,
  getThemeDocumentAttributes,
  resolveThemeMode,
  setThemeMode,
  themeModeCookieName,
  themeModes,
};

export type { ThemeMode };
