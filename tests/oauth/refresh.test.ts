import { describe, expect, it, vi } from "vitest";
import {
  createXaiOAuth,
  refreshXaiCredentials,
} from "../../extensions/xai/oauth";
import { XAI_OAUTH_TOKEN_URL } from "../../extensions/xai/constants";
import { jsonResponse } from "../fixtures/http";

describe("OAuth refresh", () => {
  it("rotates or preserves refresh tokens without renegotiating scope", async () => {
    const bodies: Record<string, string>[] = [];
    const replies = [
      jsonResponse({
        access_token: "rotated",
        refresh_token: "rotated-refresh",
        expires_in: 3600,
      }),
      jsonResponse({
        access_token: "preserved",
        expires_in: 3600,
        id_token: "unvalidated",
      }),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: any, init: RequestInit) => {
        expect(String(url)).toBe(XAI_OAUTH_TOKEN_URL);
        expect(init).toMatchObject({ method: "POST", redirect: "error" });
        bodies.push(Object.fromEntries(new URLSearchParams(String(init.body))));
        return replies.shift()!;
      }),
    );
    const oauth = createXaiOAuth({ getExistingCredentials: () => null });
    const base = {
      access: "old",
      refresh: "old-refresh",
      expires: 1,
      tokenEndpoint: XAI_OAUTH_TOKEN_URL,
    };
    expect((await oauth.refreshToken(base)).refresh).toBe("rotated-refresh");
    const preserved = await oauth.refreshToken(base);
    expect(preserved).toMatchObject({
      access: "preserved",
      refresh: "old-refresh",
    });
    expect(preserved).not.toHaveProperty("idToken");
    expect(bodies.every((body) => !("scope" in body))).toBe(true);
    expect(bodies[0]).toEqual({
      grant_type: "refresh_token",
      refresh_token: "old-refresh",
      client_id: "b1a00492-073a-47ea-816f-4c329264a828",
    });
  });

  it("rejects missing refresh and untrusted token endpoints", async () => {
    await expect(
      refreshXaiCredentials({ access: "expired", refresh: "", expires: 1 }),
    ).rejects.toThrow(/do not include a refresh token/);
    await expect(
      refreshXaiCredentials({
        access: "expired",
        refresh: "refresh",
        expires: 1,
        tokenEndpoint: "https://evil.x.ai/oauth2/token",
      }),
    ).rejects.toThrow(/untrusted token endpoint/);
  });

  it("redacts token error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { error: "invalid_grant", error_description: "TOKEN_SECRET" },
          400,
        ),
      ),
    );
    const error = await refreshXaiCredentials({
      access: "old",
      refresh: "refresh",
      expires: 1,
      tokenEndpoint: XAI_OAUTH_TOKEN_URL,
    }).catch((value) => value as Error);
    expect(error.message).toMatch(/status 400/);
    expect(error.message).not.toContain("TOKEN_SECRET");
  });
});
