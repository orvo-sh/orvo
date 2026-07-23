import adapter from "@sveltejs/adapter-node";
import { fileURLToPath } from "node:url";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    warningFilter: (w) => ["state_referenced_locally"].includes(w),
    // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
    runes: ({ filename }) =>
      filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
    experimental: {
      async: true,
    },
  },
  kit: {
    csrf: {
      trustedOrigins: ["*"],
    },
    alias: {
      "@repo/storage": fileURLToPath(
        new URL("../../packages/storage/src/index.ts", import.meta.url),
      ),
    },
    experimental: {
      instrumentation: {
        server: true,
      },
      tracing: {
        server: true,
      },
      remoteFunctions: true,
    },
    adapter: adapter(),
  },
};

export default config;
