import { browser } from "$app/environment";

const startAutoRefresh = ({
  refresh,
  intervalMs,
  refreshOnFocus = true,
  refreshOnVisible = true,
}: {
  refresh: () => void | Promise<void>;
  intervalMs: number;
  refreshOnFocus?: boolean;
  refreshOnVisible?: boolean;
}) => {
  if (!browser) return () => { };

  const pollInterval = window.setInterval(() => {
    if (document.hidden) return;
    void refresh()
  }, intervalMs);

  const handleVisibilityChange = () => { if (refreshOnVisible && !document.hidden) void refresh() }

  const handleFocus = () => {
    if (refreshOnFocus) void refresh()
  };

  if (refreshOnVisible) document.addEventListener("visibilitychange", handleVisibilityChange);
  if (refreshOnFocus) window.addEventListener("focus", handleFocus);

  return () => {
    clearInterval(pollInterval);

    if (refreshOnVisible) document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (refreshOnFocus) window.removeEventListener("focus", handleFocus);
  };
};

export { startAutoRefresh };
