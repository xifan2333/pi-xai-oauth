xAI (Grok) provider extension for Pi with clean OAuth-style login.

This package adds full support for Grok models (including reasoning) through the official xAI API.

## Features

- Real OAuth login (`/login xai-oauth`) with device code flow + refresh tokens
- Uses the modern `openai-responses` API
- Custom tools: `xai_generate_text` and `xai_multi_agent`
- Agentic tools: `web_search`, `x_search`, `code_execution`
- Full reasoning support with thinking levels (`low` / `medium` / `high`)
- Automatic detection of existing `~/.grok/auth.json`

## Installation

```bash
# Recommended
pi install npm:pi-xai-oauth

# Or install from GitHub
pi install git:github.com/BlockedPath/pi-xai-oauth
```

## Usage

After installing, authenticate using:

```bash
pi /login xai-oauth
```

Then select any supported Grok model with `/model` or `--model`.

## Supported Models

- `grok-3`
- `grok-3-mini`
- `grok-4`
- `grok-4.3` (1M context)

All models support extended thinking with levels: `low`, `medium`, `high`.

## Quick Reference

| Action                    | Command                              |
|---------------------------|--------------------------------------|
| Install                   | `pi install npm:pi-xai-oauth`        |
| Try without installing    | `pi -e npm:pi-xai-oauth`             |
| Update                    | `pi update npm:pi-xai-oauth`         |
| Remove                    | `pi remove npm:pi-xai-oauth`         |
| List installed packages   | `pi list`                            |

## Authentication

Run:

```bash
pi /login xai-oauth
```

Pi displays the same xAI OAuth endpoint used by the official Grok CLI (`https://auth.x.ai/oauth2/authorize`) and listens on `127.0.0.1:56121/callback` for the redirect. Copy the shown URL into the browser/profile you want to use. After approval, it stores OAuth access/refresh tokens and refreshes them automatically.

If official Grok CLI credentials already exist in `~/.grok/auth.json`, Pi can reuse them. This is separate from creating an `xai-...` API key in the xAI API console.

## Updating the Package

```bash
# 1. Bump version in package.json
# 2. Publish new version
npm publish
```

Users can update with:

```bash
pi update npm:pi-xai-oauth
```
