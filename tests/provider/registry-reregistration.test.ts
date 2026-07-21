import * as PiCodingAgent from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	resolvePiManagedXaiCredential,
	resolveRegistryRequestAuth,
} from "../../extensions/xai/auth";
import {
	CURATED_FALLBACK_MODELS,
	setXaiRuntimeModels,
} from "../../extensions/xai/models";
import { TEST_MODEL } from "../fixtures/models";
import { createTempDir } from "../fixtures/temp";

let temp: Awaited<ReturnType<typeof createTempDir>>;

const staleProviderConfig = {
	name: "xAI stale catalog",
	baseUrl: "https://example.invalid/stale/v1",
	api: "openai-responses",
	authHeader: true,
	models: [
		{
			id: "stale-bundled-model",
			name: "Stale bundled model",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 8_000,
			maxTokens: 100,
		},
	],
};

const refreshedProviderConfig = {
	name: "xAI refreshed catalog",
	baseUrl: "https://cli-chat-proxy.grok.com/v1",
	api: "openai-responses",
	authHeader: true,
	models: [
		{
			id: "grok-4.5",
			name: "Grok 4.5",
			reasoning: true,
			input: ["text", "image"],
			cost: { input: 2, output: 6, cacheRead: 0.5, cacheWrite: 0 },
			contextWindow: 500_000,
			maxTokens: 64_000,
		},
		{
			id: "new-entitled",
			name: "New entitled",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 100_000,
			maxTokens: 8_000,
		},
	],
};

beforeEach(async () => {
	temp = await createTempDir("pi-xai-registry-");
	vi.stubEnv("HOME", temp.path);
});

afterEach(async () => {
	setXaiRuntimeModels(CURATED_FALLBACK_MODELS);
	vi.unstubAllEnvs();
	await temp.cleanup();
});

describe("ModelRegistry re-registration precedence", () => {
	it("replaces a stale registered catalog when models are re-registered", async () => {
		const codingAgent = PiCodingAgent as any;
		if (typeof codingAgent.ModelRuntime !== "function") {
			// Minimum matrix (0.80.1) still uses the older registry surface.
			expect(true).toBe(true);
			return;
		}

		const runtime = await codingAgent.ModelRuntime.create({
			modelsPath: null,
			allowModelNetwork: false,
		});
		const registry = new codingAgent.ModelRegistry(runtime);

		registry.registerProvider("xai-auth", staleProviderConfig);
		await runtime.refresh({ allowNetwork: false });
		expect(registry.find("xai-auth", "stale-bundled-model")).toBeDefined();
		expect(registry.find("xai-auth", "grok-4.5")).toBeUndefined();

		// Extension catalog refresh unregisters then re-registers with the new
		// exact entitlement set so stale models cannot outlive a successful refresh.
		registry.unregisterProvider("xai-auth");
		registry.registerProvider("xai-auth", refreshedProviderConfig);
		await runtime.refresh({ allowNetwork: false });

		expect(registry.find("xai-auth", "stale-bundled-model")).toBeUndefined();
		expect(registry.find("xai-auth", "grok-4.5")).toMatchObject({
			id: "grok-4.5",
			baseUrl: "https://cli-chat-proxy.grok.com/v1",
			contextWindow: 500_000,
		});
		expect(registry.find("xai-auth", "new-entitled")).toBeDefined();

		const ids = registry
			.getAll()
			.filter((model: { provider: string }) => model.provider === "xai-auth")
			.map((model: { id: string }) => model.id)
			.sort();
		expect(ids).toEqual(["grok-4.5", "new-entitled"]);
	});

	it("projects ModelRuntime.getAuth through the registry facade for request auth", async () => {
		const codingAgent = PiCodingAgent as any;
		if (typeof codingAgent.ModelRuntime !== "function") {
			expect(true).toBe(true);
			return;
		}

		let stored: any = {
			type: "oauth",
			access: "registry-oauth-access",
			refresh: "refresh",
			expires: Date.now() + 60_000,
		};
		const credentialStore = {
			async read(providerId: string) {
				return providerId === "xai-auth" ? stored : undefined;
			},
			async list() {
				return stored ? [{ providerId: "xai-auth", type: stored.type }] : [];
			},
			async modify(
				_providerId: string,
				update: (current: any) => Promise<any>,
			) {
				const next = await update(stored);
				if (next !== undefined) stored = next;
				return stored;
			},
			async delete() {
				stored = undefined;
			},
		};

		const runtime = await codingAgent.ModelRuntime.create({
			credentials: credentialStore,
			modelsPath: null,
			allowModelNetwork: false,
		});
		const registry = new codingAgent.ModelRegistry(runtime);
		registry.registerProvider("xai-auth", {
			...refreshedProviderConfig,
			oauth: {
				name: "xAI registry auth",
				async login() {
					throw new Error("not used");
				},
				async refreshToken(credentials: any) {
					return credentials;
				},
				getApiKey(credentials: any) {
					return credentials.access;
				},
			},
		});
		await runtime.refresh({ allowNetwork: false });

		const model = registry.find("xai-auth", "grok-4.5");
		expect(model).toBeDefined();

		const auth = await resolveRegistryRequestAuth(registry, model);
		expect(auth).toMatchObject({
			ok: true,
			apiKey: "registry-oauth-access",
		});

		await expect(
			resolvePiManagedXaiCredential({
				model: { ...TEST_MODEL, id: "grok-4.5" },
				modelRegistry: registry,
			}),
		).resolves.toEqual({
			kind: "oauth-session",
			token: "registry-oauth-access",
		});
	});

	it("falls back to provider-scoped getProviderAuth when model auth is unavailable", async () => {
		const auth = await resolveRegistryRequestAuth({
			getProviderAuth: async () => ({
				auth: {
					apiKey: "provider-scoped-token",
					headers: { Authorization: "Bearer provider-scoped-token" },
				},
				source: "stored OAuth",
			}),
		});
		expect(auth).toEqual({
			ok: true,
			apiKey: "provider-scoped-token",
			headers: { Authorization: "Bearer provider-scoped-token" },
		});
	});
});
