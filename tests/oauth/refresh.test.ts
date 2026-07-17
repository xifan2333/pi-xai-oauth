import { describe, expect, it, vi } from "vitest";
import packageMetadata from "../../package.json";
import {
  createXaiOAuth,
  refreshXaiCredentials,
} from "../../extensions/xai/oauth";
import { XAI_OAUTH_TOKEN_URL } from "../../extensions/xai/constants";
import { jsonResponse } from "../fixtures/http";
import { XAI_USER_AGENT } from "../../extensions/xai/constants";
import { resolveXaiOAuthClientSurface } from "../../extensions/xai/wire";

describe("OAuth refresh", () => {
  it("rotates or preserves refresh tokens without renegotiating scope", async () => {
    const bodies: Record<string, string>[] = [];
    const headers: Headers[] = [];
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
        headers.push(new Headers(init.headers));
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
    expect(headers[0].get("Accept")).toBe("application/json");
    expect(headers[0].get("Content-Type")).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(headers[0].get("User-Agent")).toBe(XAI_USER_AGENT);
    expect(headers[0].get("X-Grok-Client-Version")).toBe(
      packageMetadata.version,
    );
    expect(headers[0].get("X-Grok-Client-Surface")).toBe(
      resolveXaiOAuthClientSurface(),
    );
    expect(headers[0].get("X-XAI-Token-Auth")).toBeNull();
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
