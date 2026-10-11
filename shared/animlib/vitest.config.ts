import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // QuickJS deadlines measure wall time, including time waiting for CPU.
    // Run files serially so competing VMs do not exhaust those deadlines in CI.
    maxWorkers: 1,
  },
});
