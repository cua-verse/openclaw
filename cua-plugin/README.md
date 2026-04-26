# OpenClaw CUA Plugin

Standalone OpenClaw plugin that exposes [LiteDesktopActionSpace](../../../../../bridges/cua_mcp_server/src/index.js) desktop-control tools to an OpenClaw agent. The plugin proxies actions through a local `cua-computer-server` (default `http://localhost:5000`).

This package lives inside the OpenClaw fork (`cua-verse/openclaw`, `agenthle` branch) but is **not** a workspace member — it ships its own dependencies and build pipeline so it can be installed onto a VM without `pnpm install`-ing the entire OpenClaw monorepo.

## Action space

Mirrors the CUA MCP server exactly. All 14 tools, normalized `[0, 1000]` coordinates:

| Tool | Parameters |
|---|---|
| `screenshot` | `save_path?: string` |
| `click` | `coordinate?: [num, num]`, `button?`, `clicks?: 1\|2\|3` |
| `type` | `text: string` |
| `key` / `key_down` / `key_up` | `keys: string[]` |
| `hold_key` | `keys: string[]`, `duration: number` |
| `mouse_move` | `coordinate: [num, num]` |
| `mouse_down` / `mouse_up` | `button?` |
| `drag` | `coordinate`, `start_coordinate?`, `button?` |
| `scroll` | `direction`, `amount`, `coordinate?` |
| `wait` | `duration: number` |
| `cursor_position` | (none) |

All tools registered with `optional: true` — the host OpenClaw config must
list them under `tools.alsoAllow` to enable.

## Build

```bash
npm install
npm run build      # → dist/index.cjs
npm run selftest   # verifies all 14 tools register without hitting CUA
```

`dist/index.cjs` is a single self-contained CommonJS bundle with `@sinclair/typebox` inlined.

## Install on a VM

The `agenthle` deployer uploads this directory to `~/openclaw-cua-plugin/`, runs `npm install && npm run build`, then copies the resulting layout to OpenClaw's extension dir:

```text
~/.openclaw/extensions/cua/
├── package.json
├── openclaw.plugin.json
└── dist/
    └── index.cjs
```

OpenClaw discovers the plugin from `~/.openclaw/extensions/cua/package.json` (`openclaw.extensions: ["./dist/index.cjs"]`) and reads metadata from `openclaw.plugin.json`.

## Plugin contract

Verified against the fork at `src/plugins/types.ts` and `src/agents/tools/common.ts`:

- Entry exports a default `register(api)` callback (loader accepts both `definePluginEntry({...})` and bare callback forms).
- Each tool object has `{ name, description, label, parameters, execute }`.
- `parameters` is a Typebox `Type.Object({...})` — no top-level `anyOf`/`oneOf` (validators reject those).
- `execute(toolCallId, params, signal?, onUpdate?)` returns `{ content: (TextContent | ImageContent)[] }`.
- Image blocks are `{ type: "image", data: <base64>, mimeType: "image/png" }`.

If you need to mirror a change made in the CUA MCP server, edit `src/tools.ts` here, run `npm run build`, redeploy to the VM, and update the parity test under `agenthle/orchestration/external/openclaw/tests/test_action_space_parity.py`.
