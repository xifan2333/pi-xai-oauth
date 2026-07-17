import type { OAuthCredentials } from "@earendil-works/pi-ai";
import * as PiCodingAgent from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import {
  DEFAULT_XAI_MODEL,
  XAI_GROK_CLI_AUTH_SCOPE_KEY,
  XAI_GROK_CLI_LEGACY_AUTH_SCOPE_KEY,
  XAI_OAUTH_ISSUER,
  XAI_OAUTH_REFRESH_SKEW_MS,
  XAI_PROVIDER_ID,
} from "./constants";
import { getXaiRuntimeModels } from "./models";
import { ensureFreshXaiCredentials } from "./oauth";
import type { XaiCredential } from "./routing";

function readPiStoredCredential(providerId: string, authPath: string): any {
  const codingAgent = PiCodingAgent as any;
  if (typeof codingAgent.readStoredCredential === "function") {
    return codingAgent.readStoredCredential(providerId, authPath);
  }
  try {
    return JSON.parse(readFileSync(authPath, "utf8"))?.[providerId];
  } catch {
    return undefined;
  }
}

function parseExpiry(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;

  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Load reusable OAuth credentials from the official Grok CLI auth file. */
export function getGrokAuthCredentials(): OAuthCredentials | null {
  const authPath = join(homedir(), ".grok", "auth.json");
  if (!existsSync(authPath)) return null;

  try {
    const data = JSON.parse(readFileSync(authPath, "utf8"));

    // Official Grok CLI stores OAuth2 credentials under
    // "https://auth.x.ai::<client_id>" as { key, refresh_token, expires_at }.
    const oidc = data?.[XAI_GROK_CLI_AUTH_SCOPE_KEY];
    if (oidc && typeof oidc === "object") {
      const access = String(oidc.key || oidc.access_token || oidc.token || "");
      if (access) {
        const expires = parseExpiry(oidc.expires_at) || Date.now() + 6 * 60 * 60 * 1000;
        return {
          refresh: String(oidc.refresh_token || oidc.refresh || ""),
          access,
          expires: expires - XAI_OAUTH_REFRESH_SKEW_MS,
          tokenEndpoint: `${XAI_OAUTH_ISSUER}/oauth2/token`,
          tokenType: "Bearer",
        };
      }
    }

    // Older Grok builds stored a bearer at the sign-in URL scope.
    const legacy = data?.[XAI_GROK_CLI_LEGACY_AUTH_SCOPE_KEY];
    const legacyAccess = legacy && typeof legacy === "object" ? legacy.key || legacy.access_token || legacy.token : "";
    if (legacyAccess) {
      return {
        refresh: "",
        access: String(legacyAccess),
        expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };
    }

    // Back-compat with early pi-xai-oauth guesses.
    const topLevelAccess = data?.access_token || data?.token;
    if (topLevelAccess) {
      return {
        refresh: String(data.refresh_token || data.refresh || ""),
        access: String(topLevelAccess),
        expires: parseExpiry(data.expires_at || data.expires) || Date.now() + 30 * 24 * 60 * 60 * 1000,
        tokenEndpoint: `${XAI_OAUTH_ISSUER}/oauth2/token`,
        tokenType: String(data.token_type || "Bearer"),
      };
    }
  } catch {
    return null;
  }

  return null;
}

export interface StartupXaiCatalogAuth {
  credential: { access: string } | null;
  /** True when pi has an expired stored OAuth token that session_start should refresh under pi's credential lock. */
  needsRegistryRefresh: boolean;
  credentialChangedAt?: number;
}

/**
 * Resolve a fresh startup-only OAuth bearer without refreshing or modifying
 * pi's credential store. Expired pi credentials still defer lock-protected
 * refresh to the bound model registry, while a fresh official Grok CLI bearer
 * may be reused read-only for startup catalog selection.
 */
export function getStartupXaiCatalogAuth(now = Date.now()): StartupXaiCatalogAuth {
  let needsRegistryRefresh = false;
  let credentialChangedAt: number | undefined;
  try {
    const authPath = join(getAgentDir(), "auth.json");
    const stored = readPiStoredCredential(XAI_PROVIDER_ID, authPath);
    credentialChangedAt = existsSync(authPath) ? statSync(authPath).mtimeMs : undefined;
    if (stored?.type === "oauth" && typeof stored.access === "string" && stored.access) {
      if (typeof stored.expires === "number" && stored.expires > now) {
        return { credential: { access: stored.access }, needsRegistryRefresh: false, credentialChangedAt };
      }
      needsRegistryRefresh = true;
    }
  } catch {
    // Fall through to read-only official Grok CLI credential reuse.
  }

  const grok = getGrokAuthCredentials();
  if (grok?.access && typeof grok.expires === "number" && grok.expires > now) {
    const grokPath = join(homedir(), ".grok", "auth.json");
    const grokChangedAt = existsSync(grokPath) ? statSync(grokPath).mtimeMs : undefined;
    const changedAt =
      typeof credentialChangedAt === "number" && typeof grokChangedAt === "number"
        ? Math.max(credentialChangedAt, grokChangedAt)
        : grokChangedAt ?? credentialChangedAt;
    return {
      credential: { access: grok.access },
      needsRegistryRefresh,
      credentialChangedAt: changedAt,
    };
  }
  return { credential: null, needsRegistryRefresh, credentialChangedAt };
}

function xaiRegistryCandidateIds(ctx: any): string[] {
  return [
    ctx?.model?.provider === XAI_PROVIDER_ID ? ctx.model.id : undefined,
    DEFAULT_XAI_MODEL,
    ...getXaiRuntimeModels().map((model) => model.id),
  ].filter(
    (id, index, values): id is string =>
      typeof id === "string" && !!id && values.indexOf(id) === index,
  );
}

function legacyStoredOAuthAccess(registry: any): string | null | undefined {
  if (typeof registry?.authStorage?.get !== "function") return undefined;
  try {
    const stored = registry.authStorage.get(XAI_PROVIDER_ID);
    return stored?.type === "oauth"
      && typeof stored.access === "string"
      && stored.access
      ? stored.access
      : null;
  } catch {
    return null;
  }
}

function hasRuntimeApiKeyOverride(registry: any): boolean {
  if (typeof registry?.getProviderAuthStatus !== "function") return false;
  try {
    return registry.getProviderAuthStatus(XAI_PROVIDER_ID)?.source === "runtime";
  } catch {
    return true;
  }
}

function registryModelUsesOAuth(registry: any, model: any): boolean {
  try {
    if (registry.isUsingOAuth(model) !== true) return false;
    const legacyAccess = legacyStoredOAuthAccess(registry);
    if (legacyAccess !== undefined) return legacyAccess !== null;
    if (typeof registry.getProviderAuthStatus !== "function") return false;
    const status = registry.getProviderAuthStatus(XAI_PROVIDER_ID);
    return status?.configured === true && status.source === "stored";
  } catch {
    return false;
  }
}

function credentialFromResolvedAuth(auth: any): XaiCredential | null {
  if (auth?.ok && typeof auth.apiKey === "string" && auth.apiKey) {
    return { kind: "oauth-session", token: auth.apiKey };
  }
  const authorization =
    auth?.ok && typeof auth.headers?.Authorization === "string"
      ? auth.headers.Authorization
      : "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? { kind: "oauth-session", token: authorization.slice("bearer ".length) }
    : null;
}

/** Resolve a tagged xAI credential through pi's managed model registry. */
export async function resolvePiManagedXaiCredential(ctx: any): Promise<XaiCredential | null> {
  if (typeof ctx?.modelRegistry?.find !== "function" || typeof ctx?.modelRegistry?.getApiKeyAndHeaders !== "function") {
    return null;
  }
  for (const modelId of xaiRegistryCandidateIds(ctx)) {
    const registryModel = ctx.modelRegistry.find(XAI_PROVIDER_ID, modelId);
    if (!registryModel) continue;
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(registryModel);
    const credential = credentialFromResolvedAuth(auth);
    if (credential) return credential;
  }
  return null;
}

/**
 * Resolve only a Pi-stored xAI OAuth bearer, rejecting API-key credentials and
 * runtime API-key overrides even when Pi's generic request resolver returns one.
 */
export async function resolvePiManagedXaiOAuthCredential(ctx: any): Promise<XaiCredential | null> {
  const registry = ctx?.modelRegistry;
  if (
    typeof registry?.find !== "function"
    || typeof registry?.getApiKeyAndHeaders !== "function"
    || typeof registry?.isUsingOAuth !== "function"
  ) {
    return null;
  }
  const legacyAccessBefore = legacyStoredOAuthAccess(registry);
  if (legacyAccessBefore === null || hasRuntimeApiKeyOverride(registry)) {
    return null;
  }
  for (const modelId of xaiRegistryCandidateIds(ctx)) {
    const registryModel = registry.find(XAI_PROVIDER_ID, modelId);
    if (!registryModel || !registryModelUsesOAuth(registry, registryModel)) continue;
    const credential = credentialFromResolvedAuth(
      await registry.getApiKeyAndHeaders(registryModel),
    );
    const legacyAccessAfter = legacyStoredOAuthAccess(registry);
    if (
      credential
      && !hasRuntimeApiKeyOverride(registry)
      && registryModelUsesOAuth(registry, registryModel)
      && legacyAccessAfter !== null
      && (legacyAccessAfter === undefined || credential.token === legacyAccessAfter)
    ) {
      return credential;
    }
  }
  return null;
}

/**
 * Return whether Pi currently identifies an xAI registry model as stored OAuth.
 *
 * This uses the public registry facade available across Pi 0.80.1–0.80.10.
 */
export function hasPiManagedXaiOAuth(ctx: any): boolean {
  const registry = ctx?.modelRegistry;
  if (
    typeof registry?.find !== "function"
    || typeof registry?.isUsingOAuth !== "function"
    || hasRuntimeApiKeyOverride(registry)
  ) {
    return false;
  }
  const legacyAccess = legacyStoredOAuthAccess(registry);
  if (legacyAccess === null) return false;
  return xaiRegistryCandidateIds(ctx).some((modelId) => {
    const registryModel = registry.find(XAI_PROVIDER_ID, modelId);
    return !!registryModel && registryModelUsesOAuth(registry, registryModel);
  });
}

/** Resolve a tagged xAI OAuth credential from pi context or reusable Grok CLI credentials. */
export async function resolveXaiCredential(ctx: any): Promise<XaiCredential | null> {
  const managedCredential = await resolvePiManagedXaiCredential(ctx);
  if (managedCredential) return managedCredential;
  if (ctx?.apiKey) return { kind: "oauth-session", token: ctx.apiKey };

  const credentials = getGrokAuthCredentials();
  if (!credentials?.access) return null;
  return { kind: "oauth-session", token: (await ensureFreshXaiCredentials(credentials)).access };
}
