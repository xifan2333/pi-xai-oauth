import packageMetadata from "../../package.json";

export const XAI_OAUTH_ISSUER = "https://auth.x.ai";
export const XAI_OAUTH_DISCOVERY_URL = `${XAI_OAUTH_ISSUER}/.well-known/openid-configuration`;
export const XAI_OAUTH_AUTHORIZATION_URL = `${XAI_OAUTH_ISSUER}/oauth2/authorize`;
export const XAI_OAUTH_TOKEN_URL = `${XAI_OAUTH_ISSUER}/oauth2/token`;
export const XAI_OAUTH_JWKS_URL = `${XAI_OAUTH_ISSUER}/.well-known/jwks.json`;
export const XAI_OAUTH_ID_TOKEN_ALGORITHM = "ES256";
export const XAI_OAUTH_PKCE_METHOD = "S256";
export const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
export const XAI_OAUTH_SCOPE =
  "openid profile email offline_access grok-cli:access api:access conversations:read conversations:write";
export const XAI_OAUTH_REDIRECT_HOST = "127.0.0.1";
export const XAI_OAUTH_REDIRECT_PORT = 56121;
export const XAI_OAUTH_REDIRECT_PATH = "/callback";
export const XAI_OAUTH_REFRESH_SKEW_MS = 2 * 60 * 1000;

export const XAI_API_BASE_URL = "https://api.x.ai/v1";
export const XAI_CLI_BASE_URL = "https://cli-chat-proxy.grok.com/v1";
export const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";
export const XAI_CLI_RESPONSES_URL = "https://cli-chat-proxy.grok.com/v1/responses";
export const XAI_CLI_MODELS_URL = "https://cli-chat-proxy.grok.com/v1/models-v2";
export const XAI_IMAGES_GENERATIONS_URL = "https://api.x.ai/v1/images/generations";

export const XAI_MODEL_CATALOG_CACHE_SCHEMA = 1;
export const XAI_MODEL_CATALOG_FRESH_TTL_MS = 15 * 60 * 1000;
export const XAI_MODEL_CATALOG_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
export const XAI_MODEL_CATALOG_TIMEOUT_MS = 5 * 1000;
export const XAI_MODEL_CATALOG_MAX_BYTES = 1024 * 1024;

export const XAI_CLIENT_IDENTIFIER = packageMetadata.name;
export const XAI_CLIENT_VERSION = packageMetadata.version;
export const XAI_PROVIDER_ID = "xai-auth";
export const DEFAULT_XAI_MODEL = "grok-4.5";
export const DEFAULT_XAI_IMAGE_MODEL = "grok-imagine-image-quality";

export const XAI_CURSOR_TOOL_NAMES = ["Read", "Write", "StrReplace", "Edit", "Delete", "LS", "Grep", "Glob", "Shell", "WebSearch"];
export const XAI_CURSOR_AUTO_TOOL_NAMES = ["Read", "Write", "StrReplace", "Edit", "Delete", "LS", "Grep", "Glob", "Shell"];

export const XAI_GROK_CLI_AUTH_SCOPE_KEY = `${XAI_OAUTH_ISSUER}::${XAI_OAUTH_CLIENT_ID}`;
export const XAI_GROK_CLI_LEGACY_AUTH_SCOPE_KEY = "https://accounts.x.ai/sign-in";
