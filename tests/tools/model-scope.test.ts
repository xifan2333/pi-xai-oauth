import { describe, expect, it } from "vitest";
import {
  XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME,
  XAI_GROK_NATIVE_WEB_SEARCH_NAME,
} from "../../extensions/xai/constants";
import {
  isXaiNetworkToolActive,
  setXaiNetworkToolActive,
  syncXaiNetworkToolsForModel,
  XAI_NETWORK_TOOL_NAMES,
} from "../../extensions/xai/tools/model-scope";
import { createExtensionHarness } from "../fixtures/extension-api";
import { BUILTIN_XAI_TEST_MODEL, TEST_MODEL } from "../fixtures/models";

describe("network-tool lifecycle", () => {
  it("requires an active xAI model for web_search", () => {
    const h = createExtensionHarness([...XAI_NETWORK_TOOL_NAMES]);
    expect(
      setXaiNetworkToolActive(h.api, undefined, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME, true),
    ).toMatchObject({ ok: false, active: false });
    expect(
      setXaiNetworkToolActive(
        h.api,
        TEST_MODEL,
        XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME,
        true,
      ),
    ).toEqual({ ok: true, active: true });
    expect(isXaiNetworkToolActive(h.api, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME)).toBe(true);
  });
  it("resets every network tool at session start", () => {
    const h = createExtensionHarness([...XAI_NETWORK_TOOL_NAMES, "read"]);
    syncXaiNetworkToolsForModel(h.api, TEST_MODEL, { reset: true });
    expect(
      XAI_NETWORK_TOOL_NAMES.every(
        (name) => !h.getActiveTools().includes(name),
      ),
    ).toBe(true);
    expect(h.getActiveTools()).toContain("read");
  });
  it("preserves explicit selections for both xAI providers but removes them outside xAI", () => {
    const h = createExtensionHarness();
    setXaiNetworkToolActive(h.api, BUILTIN_XAI_TEST_MODEL, "xai_generate_image", true);
    syncXaiNetworkToolsForModel(h.api, BUILTIN_XAI_TEST_MODEL);
    expect(isXaiNetworkToolActive(h.api, "xai_generate_image")).toBe(true);
    syncXaiNetworkToolsForModel(h.api, {
      provider: "anthropic",
      id: "claude",
    } as any);
    expect(h.getActiveTools()).not.toContain("xai_generate_image");
    syncXaiNetworkToolsForModel(h.api, BUILTIN_XAI_TEST_MODEL);
    expect(h.getActiveTools()).not.toContain("xai_generate_image");

    expect(
      setXaiNetworkToolActive(h.api, TEST_MODEL, "xai_generate_image", true),
    ).toEqual({ ok: true, active: true });
  });
  it("does not mutate another extension's public web_search activation", () => {
    const h = createExtensionHarness(["read", XAI_GROK_NATIVE_WEB_SEARCH_NAME]);
    syncXaiNetworkToolsForModel(h.api, TEST_MODEL);
    expect(h.getActiveTools()).toContain(XAI_GROK_NATIVE_WEB_SEARCH_NAME);
    syncXaiNetworkToolsForModel(h.api, {
      provider: "anthropic",
      id: "claude",
    } as any);
    expect(h.getActiveTools()).toContain(XAI_GROK_NATIVE_WEB_SEARCH_NAME);
    expect(h.getActiveTools()).not.toContain(XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME);
  });
  it("fails closed on registry read or write errors without partial authorization", () => {
    const read = createExtensionHarness();
    read.failRegistry({ get: true });
    expect(
      setXaiNetworkToolActive(read.api, TEST_MODEL, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME, true),
    ).toMatchObject({
      ok: false,
      active: false,
      error: expect.stringMatching(/could not be read/),
    });
    const write = createExtensionHarness();
    write.failRegistry({ set: true });
    expect(
      setXaiNetworkToolActive(write.api, TEST_MODEL, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME, true),
    ).toMatchObject({
      ok: false,
      active: false,
      error: expect.stringMatching(/could not be updated/),
    });
    write.failRegistry();
    expect(isXaiNetworkToolActive(write.api, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME)).toBe(false);
  });
  it("selectively disables one tool while preserving another", () => {
    const h = createExtensionHarness();
    setXaiNetworkToolActive(h.api, TEST_MODEL, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME, true);
    setXaiNetworkToolActive(h.api, TEST_MODEL, "xai_generate_image", true);
    expect(
      setXaiNetworkToolActive(h.api, undefined, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME, false),
    ).toEqual({ ok: true, active: false });
    expect(isXaiNetworkToolActive(h.api, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME)).toBe(false);
    expect(isXaiNetworkToolActive(h.api, "xai_generate_image")).toBe(true);
  });
  it("does not allow direct registry injection to bypass package authorization", () => {
    const h = createExtensionHarness([...XAI_NETWORK_TOOL_NAMES]);
    syncXaiNetworkToolsForModel(h.api, TEST_MODEL);
    expect(
      XAI_NETWORK_TOOL_NAMES.every(
        (name) => !h.getActiveTools().includes(name),
      ),
    ).toBe(true);
  });
});
