import { mergeConfig } from "vite";
import { defineConfig } from "vitest/config";

import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "node",
      hookTimeout: 120_000,
      testTimeout: 120_000,
      include: [
        "tests/unit/**/*.test.ts",
        "tests/integration/**/*.test.ts",
      ],
      reporters: ["default"],
    },
  }),
);
