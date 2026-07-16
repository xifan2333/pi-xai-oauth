import type { XaiDeviceAuthorization } from "../../extensions/xai/device-auth";
import { jsonResponse } from "./http";

export const devicePayload = (overrides: Record<string, unknown> = {}) => ({
  device_code: "opaque-device-code",
  user_code: "ABCD-EFGH",
  verification_uri: "https://auth.x.ai/device",
  expires_in: 600,
  interval: 5,
  ...overrides,
});
export const tokenPayload = (overrides: Record<string, unknown> = {}) => ({
  access_token: "device-access-token",
  refresh_token: "device-refresh-token",
  expires_in: 3600,
  token_type: "Bearer",
  id_token: "unvalidated-device-id-token",
  ...overrides,
});
export const deviceFixture = (
  overrides: Partial<XaiDeviceAuthorization> = {},
): XaiDeviceAuthorization => ({
  deviceCode: "opaque-device-code",
  userCode: "ABCD-EFGH",
  verificationUri: "https://auth.x.ai/device",
  intervalSeconds: 5,
  expiresInSeconds: 600,
  ...overrides,
});
export function makeClock(start = 1_000_000) {
  let current = start;
  const sleeps: number[] = [];
  return {
    now: () => current,
    sleeps,
    sleep: async (ms: number, signal?: AbortSignal) => {
      if (signal?.aborted) throw new Error("cancelled");
      sleeps.push(ms);
      current += ms;
    },
  };
}
export { jsonResponse };
