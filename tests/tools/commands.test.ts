import { describe, expect, it } from "vitest";
import {
  XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME,
  XAI_GROK_NATIVE_WEB_SEARCH_NAME,
} from "../../extensions/xai/constants";
import {
  registerXaiToolsCommand,
  XAI_TOOLS_MENU_CHANNEL,
} from "../../extensions/xai/tools/commands";
import { registerCustomXaiTools } from "../../extensions/xai/tools/custom-tools";
import {
  isXaiNetworkToolActive,
  syncXaiNetworkToolsForModel,
  XAI_NETWORK_TOOL_NAMES,
} from "../../extensions/xai/tools/model-scope";
import {
  KNOWN_XAI_MODEL_METADATA,
  XaiModelInputProvenance,
} from "../../extensions/xai/models";
import { createXaiVisionRoutingController } from "../../extensions/xai/vision-routing";
import {
  commandContext,
  createExtensionHarness,
} from "../fixtures/extension-api";
import { TEST_MODEL } from "../fixtures/models";

function setup() {
  const h = createExtensionHarness();
  registerXaiToolsCommand(h.api);
  const notices: any[] = [];
  const run = (args: string, model: any = TEST_MODEL, overrides: any = {}) =>
    h.commands
      .get("xai-tools")
      .handler(args, commandContext(model, notices, overrides));
  return { h, notices, run };
}

describe("/xai-tools command", () => {
  it("enables vision routing as transport policy without registering an active tool", async () => {
    const h = createExtensionHarness();
    const routing = createXaiVisionRoutingController();
    const source = {
      ...KNOWN_XAI_MODEL_METADATA[0],
      id: "text-source",
      input: ["text"] as ["text"],
      inputProvenance: XaiModelInputProvenance.AuthenticatedInputModalities,
    };
    const target = {
      ...KNOWN_XAI_MODEL_METADATA[0],
      id: "vision-target",
      input: ["text", "image"] as ["text", "image"],
      inputProvenance: XaiModelInputProvenance.AuthenticatedInputModalities,
    };
    routing.replaceCatalog([source, target]);
    registerXaiToolsCommand(h.api, routing);
    const notices: any[] = [];
    const model = { ...TEST_MODEL, id: source.id, input: ["text"] };
    const run = (args: string) =>
      h.commands.get("xai-tools").handler(args, commandContext(model, notices));

    await run("enable vision-routing");
    expect(routing.status(model as any)).toMatchObject({
      state: "enabled",
      targetModelId: "vision-target",
    });
    expect(notices.at(-1).message).toMatch(/separate authenticated request.*usage or credits.*sensitive session content/s);
    expect(h.getActiveTools()).not.toContain("vision-routing");
    await run("status");
    expect(notices.at(-1).message).toMatch(/vision-routing=enabled \(text-source -> vision-target\)/);
    await run("disable vision-routing");
    expect(routing.status(model as any).state).toBe("eligible");
    expect(h.getActiveTools()).not.toContain("vision-routing");
  });

  it("registers and enables/disables one eligible tool with cost warning", async () => {
    const { h, notices, run } = setup();
    expect(h.commands.has("xai-tools")).toBe(true);
    await run("enable xai_generate_image");
    expect(isXaiNetworkToolActive(h.api, "xai_generate_image")).toBe(true);
    expect(notices.at(-1).message).toMatch(/may use xAI credits/);
    await run("disable xai_generate_image");
    expect(isXaiNetworkToolActive(h.api, "xai_generate_image")).toBe(false);
  });
  it("requires explicit user intent in the image-generation tool guidance", () => {
    const h = createExtensionHarness();
    registerCustomXaiTools(h.api);
    expect(h.tools.get("xai_generate_image").promptGuidelines).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/explicitly asks to generate an image/),
      ]),
    );
  });
  it("requires explicit edit intent and local-reference guidance", () => {
    const h = createExtensionHarness();
    registerCustomXaiTools(h.api);
    expect(h.tools.get("xai_edit_image").promptGuidelines).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/explicitly asks to edit or transform/),
        expect.stringMatching(/workspace paths or PNG\/JPEG data URLs/),
      ]),
    );
  });

  it("reports every tool status with one web_search entry", async () => {
    const { notices, run } = setup();
    await run("status");
    const message = notices.at(-1).message;
    for (const name of XAI_NETWORK_TOOL_NAMES) {
      const displayName = name === XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME
        ? XAI_GROK_NATIVE_WEB_SEARCH_NAME
        : name;
      expect(message).toMatch(new RegExp(`${displayName}=(?:enabled|disabled)`));
    }
    expect(message.match(/web_search=(?:enabled|disabled)/g)).toHaveLength(1);
    expect(message).not.toMatch(/xai_web_search=/);
  });
  it("rejects paid tools for non-xAI models and allows web_search for xAI models", async () => {
    const { h, notices, run } = setup();
    await run("enable xai_x_search", { provider: "anthropic", id: "claude" });
    expect(isXaiNetworkToolActive(h.api, "xai_x_search")).toBe(false);
    expect(notices.at(-1).message).toMatch(/Select an xAI\/Grok model/);
    await run("enable web_search");
    expect(isXaiNetworkToolActive(h.api, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME)).toBe(true);
    await run("disable xai_web_search");
    expect(isXaiNetworkToolActive(h.api, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME)).toBe(false);
    await run("enable xai_web_search");
    expect(isXaiNetworkToolActive(h.api, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME)).toBe(true);
    expect(notices.at(-1).message).toMatch(/Enabled web_search/);
  });
  it("fails closed when registry reads or writes fail", async () => {
    const { h, notices, run } = setup();
    h.failRegistry({ get: true });
    await run("enable xai_web_search");
    h.failRegistry();
    expect(isXaiNetworkToolActive(h.api, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME)).toBe(false);
    expect(notices.at(-1).message).toMatch(/could not be read/);
    h.failRegistry({ set: true });
    await run("enable xai_web_search");
    h.failRegistry();
    expect(isXaiNetworkToolActive(h.api, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME)).toBe(false);
    expect(notices.at(-1).message).toMatch(/could not be updated/);
  });
  it("uses the RPC picker to toggle a selection", async () => {
    const { h, notices } = setup();
    let pass = 0;
    let title = "";
    let options: string[] = [];
    const ctx = commandContext(TEST_MODEL, notices, {
      mode: "rpc",
      ui: {
        notify(message: string, type?: string) {
          notices.push({ message, type });
        },
        select: async (value: string, choices: string[]) => {
          title = value;
          options = choices;
          return ++pass === 1
            ? choices.find((choice) => choice.includes("web_search"))
            : "Done";
        },
      },
    });
    await h.commands.get("xai-tools").handler("", ctx);
    expect(isXaiNetworkToolActive(h.api, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME)).toBe(true);
    expect(title).toMatch(/explicit opt-in/);
    expect(options.filter((value) => value.includes("web_search"))).toHaveLength(1);
    expect(options.every((value) => !value.includes("xai_web_search"))).toBe(true);
    expect(
      options.some(
        (value) =>
          value.includes("xai_generate_image") && value.includes("per image"),
      ),
    ).toBe(true);
  });
  it("preserves another authorization when disabling through a non-xAI command context", async () => {
    const { h, run } = setup();
    await run("enable xai_web_search");
    await run("enable xai_generate_image");
    await run("disable xai_web_search", {
      provider: "anthropic",
      id: "claude",
    });

    expect(isXaiNetworkToolActive(h.api, XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME)).toBe(false);
    expect(isXaiNetworkToolActive(h.api, "xai_generate_image")).toBe(true);
    syncXaiNetworkToolsForModel(h.api, TEST_MODEL);
    expect(isXaiNetworkToolActive(h.api, "xai_generate_image")).toBe(true);
  });

  it("recovers from a failed reset by stripping every stale tool except the selected one", async () => {
    const { h, run } = setup();
    h.setActiveTools([...h.getActiveTools(), ...XAI_NETWORK_TOOL_NAMES]);
    h.failRegistry({ set: true });
    syncXaiNetworkToolsForModel(h.api, TEST_MODEL, { reset: true });
    h.failRegistry();
    expect(
      XAI_NETWORK_TOOL_NAMES.every((name) => h.getActiveTools().includes(name)),
    ).toBe(true);

    await run("enable xai_web_search");
    expect(
      XAI_NETWORK_TOOL_NAMES.filter((name) =>
        h.getActiveTools().includes(name),
      ),
    ).toEqual([XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME]);
    syncXaiNetworkToolsForModel(h.api, TEST_MODEL);
    expect(
      XAI_NETWORK_TOOL_NAMES.filter((name) =>
        h.getActiveTools().includes(name),
      ),
    ).toEqual([XAI_GROK_NATIVE_WEB_SEARCH_DISPATCH_NAME]);
  });

  it("keeps TUI selection in place, wraps pages, toggles, and closes", async () => {
    const { h, notices } = setup();
    let closed = false;
    const selected: string[] = [];
    const ctx = commandContext(TEST_MODEL, notices, {
      ui: {
        notify(message: string, type?: string) {
          notices.push({ message, type });
        },
        custom: async (factory: any) => {
          const bindings: any = {
            "tui.select.up": "up",
            "tui.select.down": "down",
            "tui.select.pageUp": "pageup",
            "tui.select.pageDown": "pagedown",
            "tui.select.confirm": "enter",
            "tui.select.cancel": "escape",
          };
          const component = await factory(
            { requestRender() {} },
            {
              fg: (_: any, text: string) => text,
              bg: (_: any, text: string) => text,
              bold: (text: string) => text,
            },
            { matches: (data: string, id: string) => bindings[id] === data },
            () => {
              closed = true;
            },
          );
          component.handleInput("pageup");
          selected.push(
            component.render(160).find((line: string) => line.startsWith("> ")),
          );
          component.handleInput("pagedown");
          for (let i = 0; i < 6; i++) component.handleInput("down");
          selected.push(
            component.render(160).find((line: string) => line.startsWith("> ")),
          );
          component.handleInput("enter");
          selected.push(
            component.render(160).find((line: string) => line.startsWith("> ")),
          );
          component.handleInput("escape");
        },
      },
    });
    await h.commands.get("xai-tools").handler("", ctx);
    // Page movement uses the ten-row viewport across the full tool catalog.
    expect(selected[0]).toMatch(/xai_x_search/);
    expect(selected[1]).toMatch(/\[ \] xai_edit_image/);
    expect(selected[2]).toMatch(/\[x\] xai_edit_image/);
    expect(closed).toBe(true);
    expect(isXaiNetworkToolActive(h.api, "xai_edit_image")).toBe(true);
  });

  it("wraps Page Up and Page Down across the full xAI tool catalog", async () => {
    const { h, notices } = setup();
    let afterPageUp = "";
    let afterPageDown = "";
    const ctx = commandContext(TEST_MODEL, notices, {
      ui: {
        notify(message: string, type?: string) {
          notices.push({ message, type });
        },
        custom: async (factory: any) => {
          const bindings: any = {
            "tui.select.up": "up",
            "tui.select.down": "down",
            "tui.select.pageUp": "pageup",
            "tui.select.pageDown": "pagedown",
            "tui.select.confirm": "enter",
            "tui.select.cancel": "escape",
          };
          const component = await factory(
            { requestRender() {} },
            {
              fg: (_: any, text: string) => text,
              bg: (_: any, text: string) => text,
              bold: (text: string) => text,
            },
            { matches: (data: string, id: string) => bindings[id] === data },
            () => {},
          );
          component.handleInput("pageup");
          afterPageUp = component
            .render(160)
            .find((line: string) => line.startsWith("> "));
          component.handleInput("pagedown");
          afterPageDown = component
            .render(160)
            .find((line: string) => line.startsWith("> "));
          component.handleInput("escape");
        },
      },
    });

    await h.commands.get("xai-tools").handler("", ctx);
    expect(afterPageUp).toMatch(/xai_x_search/);
    expect(afterPageDown).toMatch(/xai_generate_text/);
  });

  it("registers the clickable-menu event bridge and enables a tool via emit", async () => {
    const { h, notices } = setup();
    expect(typeof h.api.events.on).toBe("function");
    expect(typeof h.api.events.emit).toBe("function");

    const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      h.api.events.emit(XAI_TOOLS_MENU_CHANNEL, {
        action: "enable",
        tool: "xai_generate_image",
        ctx: commandContext(TEST_MODEL, notices),
        done: resolve,
      });
    });

    expect(result).toEqual({ ok: true });
    expect(isXaiNetworkToolActive(h.api, "xai_generate_image")).toBe(true);
    expect(notices.at(-1).message).toMatch(/may use xAI credits/);
  });

  it("acknowledges menu bridge open before the interactive picker closes", async () => {
    const { h, notices } = setup();
    let releasePicker!: () => void;
    const pickerHeldOpen = new Promise<void>((resolve) => {
      releasePicker = resolve;
    });
    let pickerClosed = false;

    const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      h.api.events.emit(XAI_TOOLS_MENU_CHANNEL, {
        action: "open",
        ctx: commandContext(TEST_MODEL, notices, {
          ui: {
            notify(message: string, type?: string) {
              notices.push({ message, type });
            },
            select: async () => undefined,
            custom: async () => {
              await pickerHeldOpen;
              pickerClosed = true;
            },
          },
        }),
        done: resolve,
      });
    });

    // done must win before the held picker finishes (menu host ~4s timeout).
    expect(result).toEqual({ ok: true });
    expect(pickerClosed).toBe(false);
    releasePicker();
  });

  it("rejects menu bridge open when no xAI model is active", async () => {
    const { h, notices } = setup();
    const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      h.api.events.emit(XAI_TOOLS_MENU_CHANNEL, {
        action: "open",
        ctx: commandContext(undefined, notices),
        done: resolve,
      });
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Select an xAI\/Grok model/i);
    expect(notices.at(-1).message).toMatch(/Select an xAI\/Grok model/i);
  });

  it("replies with an error when the bridge lacks a UI context", async () => {
    const { h } = setup();
    const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      h.api.events.emit(XAI_TOOLS_MENU_CHANNEL, {
        action: "status",
        done: resolve,
      });
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/command UI context/i);
  });

  it("skips bridge registration when pi.events.on is missing", () => {
    const h = createExtensionHarness();
    // Simulate older/partial API surface used by some fixtures.
    (h.api as any).events = {};
    expect(() => registerXaiToolsCommand(h.api)).not.toThrow();
    expect(h.commands.has("xai-tools")).toBe(true);
  });

});
