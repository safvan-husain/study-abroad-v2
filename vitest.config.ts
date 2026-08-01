import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "react",
    },
  },
  test: { include: ["test/**/*.test.{ts,tsx}", "services/api/test/**/*.{spec,e2e-spec}.ts"] },
});
