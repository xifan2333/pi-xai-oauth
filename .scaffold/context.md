# Shared Agent Context — Issue #69

**Project:** pi-xai-oauth
**Branch:** feature/issue-69-pi-peer-range
**Date:** 2026-07-17

## Issue Contract
Replace wildcard Pi peers with one aligned, bounded, evidence-backed pre-1.0 range. CI must install and report the exact minimum and latest allowed releases from the packed package, run the relevant tests/typecheck, detect policy drift, verify packed metadata, and prove unsupported peers are rejected or warned about during npm resolution.

## Compatibility History
- 1.2.4 / `de8d667` + `c36901b`: adapted and tested Pi 0.79.8's OpenAI Responses API guard.
- 1.3.2 / `39e8f53`: moved from the removed Pi 0.80 root Responses helper to the new subpath.
- 1.3.3 / `9283e3f`: moved to `@earendil-works/pi-ai/compat` after the Pi 0.80 extension loader rewrote the subpath incorrectly.
- Historical `eb3a700` proposed aligned `>=0.80.3 <0.81.0`, but that side-branch metadata/CI did not land on current main.

## npm Contract
- Peers express host compatibility; npm 7+ resolves them and strict-peer mode turns conflicts into install failures.
- For stable releases, `^0.80.1` is effectively the 0.80 patch line; the explicit `>=0.80.1 <0.81.0` form communicates the reviewed breaking-line boundary.
- A repository lock proves only one tree. Matrix cells must start from the packed tarball in a clean directory, install exact root Pi dev versions, and assert both resolved versions before tests.
- A checked-in latest endpoint plus a registry-drift check makes future compatible-line releases deliberate rather than silently dynamic.

## Selected Boundary
Both peers use `>=0.80.1 <0.81.0`. Pi 0.80.1 is the first published 0.80 release, contains the required compat export/loader-alias contract, and passes the full packed `npm test` plus typecheck suite. Exact 0.80.7 is the latest allowed/tested endpoint. The exclusive upper bound remains `<0.81.0` until a reviewed 0.81 release passes as a temporary candidate before metadata is widened.

## Preservation Boundaries
All runtime behavior from issues #63-#67 remains unchanged. This task changed dependency/test/CI/docs metadata and a brittle test-only import path, but no production OAuth, catalog, transport, or tool behavior.

## Delivery
Reviewed implementation commit `4ec249e` was pushed on `feature/issue-69-pi-peer-range`; unmerged PR #77 targets `main` and closes issue #69: https://github.com/BlockedPath/pi-xai-oauth/pull/77

## Research Artifacts
- `.pi-subagents/artifacts/outputs/cba02feb-19ae-45cf-92de-c9e58a1ea772/research.md`
- `.pi-subagents/artifacts/outputs/cba02feb-19ae-45cf-92de-c9e58a1ea772/context.md`
