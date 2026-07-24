import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.stubEnv("PI_CODING_AGENT_DIR", "");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
