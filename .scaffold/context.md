# Shared Agent Context — Issue #128

**Issue:** <https://github.com/BlockedPath/pi-xai-oauth/issues/128>
**Linear:** [BLO-11](https://linear.app/blockedpath/issue/BLO-11/gh-128-menu-bridge-open-waits-for-picker-close-before-done-4s-false)
**Series:** [BLO-10](https://linear.app/blockedpath/issue/BLO-10/pi-xai-oauth-menu-bridge-hardening-series-github-128-131) / GitHub #128–#131
**Branch:** `fix/128-menu-bridge-picker-timeout`

## Problem

`registerXaiToolsCommand` listens on `pi-clickable-menu:xai-tools`. For `action: "open"` it awaited `handleXaiToolsArgs` / `showXaiToolPicker` and only then called `done({ ok: true })`. `pi-clickable-menu` treats a missing `done` within ~4 seconds as bridge failure, so users who keep the picker open get a false “No xAI tools bridge response” error.

## Fix

Validate launch (active xAI model + `hasUI`), `reply({ ok: true })`, then await `showXaiToolPicker` without holding `done`. Post-launch picker errors notify only.

## Follow-ups (out of scope)

| Issue | Topic |
| --- | --- |
| #129 | Forward real success/failure through `done` for status/enable/disable |
| #130 | Expand bridge unit coverage |
| #131 | Document/share bridge contract |
