import {
  XAI_API_BASE_URL,
  XAI_CLI_BASE_URL,
  XAI_CLI_RESPONSES_URL,
  XAI_IMAGES_EDITS_URL,
  XAI_IMAGES_GENERATIONS_URL,
  XAI_RESPONSES_URL,
  XAI_VIDEOS_GENERATIONS_URL,
  XAI_VIDEOS_STATUS_PREFIX,
} from "./constants";

export type XaiCredentialKind = "oauth-session" | "api-key";

export interface XaiCredential {
  kind: XaiCredentialKind;
  token: string;
  /** Host means the active model belongs to Pi's built-in catalog, not this package's catalog. */
  catalogScope?: "host";
}

export type XaiRequestKind =
  | "responses"
  | "image-generation"
  | "image-edit"
  | "video-generation-create"
  | "video-generation-status";

export interface XaiRoute {
  baseUrl: string;
  url: string;
}

const XAI_ROUTES: Record<XaiCredentialKind, Record<XaiRequestKind, XaiRoute>> = {
  "oauth-session": {
    responses: { baseUrl: XAI_CLI_BASE_URL, url: XAI_CLI_RESPONSES_URL },
    // Official Grok Build sends Imagine requests directly to api.x.ai for
    // both OAuth sessions and BYOK credentials rather than via the chat proxy.
    "image-generation": { baseUrl: XAI_API_BASE_URL, url: XAI_IMAGES_GENERATIONS_URL },
    "image-edit": { baseUrl: XAI_API_BASE_URL, url: XAI_IMAGES_EDITS_URL },
    "video-generation-create": { baseUrl: XAI_API_BASE_URL, url: XAI_VIDEOS_GENERATIONS_URL },
    "video-generation-status": { baseUrl: XAI_API_BASE_URL, url: XAI_VIDEOS_STATUS_PREFIX },
  },
  "api-key": {
    responses: { baseUrl: XAI_API_BASE_URL, url: XAI_RESPONSES_URL },
    "image-generation": { baseUrl: XAI_API_BASE_URL, url: XAI_IMAGES_GENERATIONS_URL },
    "image-edit": { baseUrl: XAI_API_BASE_URL, url: XAI_IMAGES_EDITS_URL },
    "video-generation-create": { baseUrl: XAI_API_BASE_URL, url: XAI_VIDEOS_GENERATIONS_URL },
    "video-generation-status": { baseUrl: XAI_API_BASE_URL, url: XAI_VIDEOS_STATUS_PREFIX },
  },
};

/** Resolve an xAI endpoint from credential provenance and request kind. */
export function resolveXaiRoute(credentialKind: XaiCredentialKind, requestKind: XaiRequestKind): XaiRoute {
  return { ...XAI_ROUTES[credentialKind][requestKind] };
}
