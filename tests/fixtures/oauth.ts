import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { XAI_OAUTH_CLIENT_ID } from "../../extensions/xai/constants";

export const OIDC_KEY_ID = "test-es256-key";
export const OIDC_KEYS = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
export const OIDC_PUBLIC_JWK = {
  ...OIDC_KEYS.publicKey.export({ format: "jwk" }),
  use: "sig",
  alg: "ES256",
  kid: OIDC_KEY_ID,
};

/** Return pinned xAI discovery metadata with optional overrides. */
export function discovery(overrides: Record<string, unknown> = {}) {
  return {
    issuer: "https://auth.x.ai",
    authorization_endpoint: "https://auth.x.ai/oauth2/authorize",
    token_endpoint: "https://auth.x.ai/oauth2/token",
    jwks_uri: "https://auth.x.ai/.well-known/jwks.json",
    id_token_signing_alg_values_supported: ["ES256"],
    code_challenge_methods_supported: ["S256"],
    ...overrides,
  };
}

/** Sign a compact ES256 test ID token. */
export function signIdToken(options: {
  nonce: string;
  claims?: Record<string, unknown>;
  header?: Record<string, unknown>;
  key?: KeyObject;
  now?: number;
}) {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({
      alg: "ES256",
      kid: OIDC_KEY_ID,
      typ: "JWT",
      ...options.header,
    }),
  ).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      iss: "https://auth.x.ai",
      sub: "test-user",
      aud: XAI_OAUTH_CLIENT_ID,
      exp: now + 300,
      iat: now,
      nonce: options.nonce,
      ...options.claims,
    }),
  ).toString("base64url");
  const input = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(input, "ascii"), {
    key: options.key ?? OIDC_KEYS.privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${input}.${signature.toString("base64url")}`;
}
