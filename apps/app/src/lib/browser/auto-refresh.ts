import { browser } from "$app/environment";

const startAutoRefresh = (input: {
  refresh: () => void | Promise<void>;
  intervalMs: number;
  refreshOnFocus?: boolean;
  refreshOnVisible?: boolean;
}) => {
  if (!browser) {
    return () => {};
  }

  const {
    refresh,
    intervalMs,
    refreshOnFocus = true,
    refreshOnVisible = true,
  } = input;

  const runRefresh = () => {
    void refresh();
  };

  const pollInterval = window.setInterval(() => {
    if (document.hidden) {
      return;
    }

    runRefresh();
  }, intervalMs);

  const handleVisibilityChange = () => {
    if (refreshOnVisible && !document.hidden) {
      runRefresh();
    }
  };

  const handleFocus = () => {
    if (refreshOnFocus) {
      runRefresh();
    }
  };

  if (refreshOnVisible) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  if (refreshOnFocus) {
    window.addEventListener("focus", handleFocus);
  }

  return () => {
    clearInterval(pollInterval);

    if (refreshOnVisible) {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }

    if (refreshOnFocus) {
      window.removeEventListener("focus", handleFocus);
    }
  };
};

export { startAutoRefresh };
