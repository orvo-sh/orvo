import { browser } from "$app/environment";
import { readable } from "svelte/store";

const createNowStore = (intervalMs = 1000) =>
  readable(Date.now(), (set) => {
    if (!browser) {
      return () => {};
    }

    const interval = window.setInterval(() => {
      set(Date.now());
    }, intervalMs);

    return () => {
      clearInterval(interval);
    };
  });

export { createNowStore };
