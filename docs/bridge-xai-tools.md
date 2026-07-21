# xAI tools menu bridge protocol v1

This document defines version 1 of the in-process event bridge between
`pi-clickable-menu` (or another Pi extension) and the `/xai-tools` command
owned by `pi-xai-oauth`. `pi-xai-oauth` is the listener and owns this
contract.

Protocol v1 is a documentation and behavior version. There is no `version`
field in the v1 request. A future incompatible protocol must be documented
explicitly and use a distinguishable channel or version mechanism rather than
silently changing this contract.

## Channel and ownership

The event channel is:

```text
pi-clickable-menu:xai-tools
```

The canonical source is the exported `XAI_TOOLS_MENU_CHANNEL` constant in
[`extensions/xai/tools/commands.ts`][commands]. Listener code and this
repository's tests must use that export. A peer package that cannot import this
package without creating an unwanted dependency may repeat the documented
literal, but must treat this listener-owned document and constant as
authoritative. This contract does not require a separate shared package.

The bridge is local, in-memory extension communication through `pi.events`.
The request contains a live Pi command context and is not a JSON or
cross-process protocol.

## Request

Emit one object on the channel:

```ts
type XaiToolsMenuRequestV1 = {
  action?: "open" | "status" | "enable" | "disable";
  tool?: string;
  ctx: ExtensionCommandContext;
  done: (result: XaiToolsMenuResultV1) => void;
};
```

- `action` is an optional string. Omission defaults to `open` for
  compatibility. Values are trimmed and matched case-insensitively; emitters
  should send the lowercase values shown above.
- `tool` is required as a non-empty string for `enable` and `disable`. It is
  not used by `open` or `status`, and emitters should omit it for those
  actions.
- `ctx` is the required live `ExtensionCommandContext` from the menu host. It
  must expose `ui.notify`; `open` also requires an interactive TUI or RPC
  picker surface.
- `done` is a required callback. The listener calls it once for every accepted
  or rejected request that supplies a callable callback.

The listener validates raw fields before command dispatch. Malformed actions,
tools, or contexts return an error through a callable `done` and do not change
tool state. A request with a missing or non-callable `done` cannot be
acknowledged, so the listener ignores it without dispatching or throwing
through the shared event bus.

Example:

```ts
pi.events.emit("pi-clickable-menu:xai-tools", {
  action: "enable",
  tool: "web_search",
  ctx,
  done: (result) => {
    if (!result.ok) ctx.ui.notify(result.error, "error");
  },
});
```

## Actions

- `open` validates that an xAI model and interactive UI are available,
  acknowledges launch, and then opens the package-owned picker.
- `status` displays the current session-scoped xAI tool state through the
  supplied command context.
- `enable` enables one supported `/xai-tools` target for the current session.
- `disable` disables one supported `/xai-tools` target for the current session.

Tool names and eligibility are owned by `/xai-tools`; bridge consumers must not
maintain an independent entitlement or activation model. Unknown actions or
unsupported tool names are rejected.

## Result

```ts
type XaiToolsMenuResultV1 =
  | { ok: true }
  | { ok: false; error: string };
```

`error` is a safe, human-readable explanation. Consumers may display it, but
should branch on `ok` rather than matching exact error text.

The result is an operation result, not merely confirmation that a toast was
shown:

- `status`, `enable`, and `disable` return the shared `/xai-tools` handler's
  actual success or failure. Registry, model-eligibility, routing-policy, and
  argument failures therefore return `{ ok: false, error }`.
- `open` has an intentional timing exception. `{ ok: true }` means the picker
  was accepted for launch. The listener calls `done` before awaiting picker
  closure so a menu host does not report a false timeout while the user is
  interacting.
- A successful `open` result does not mean the user changed a tool or closed
  the picker. Failures after launch acknowledgement are reported in the Pi UI
  only; the listener does not call `done` a second time.

The emitter may enforce its own bounded timeout for a missing listener or
response. That timeout does not change the listener's acknowledgement
semantics.

[commands]: ../extensions/xai/tools/commands.ts
