/**
 * OpenClaw CUA plugin entry point.
 *
 * Registers LiteDesktopActionSpace tools backed by a local
 * cua-computer-server. Uses the bare register-callback form so this
 * package does not have to import OpenClaw's SDK at build time.
 *
 * Plugin loader contract verified at openclaw fork
 * src/plugins/types.ts (OpenClawPluginApi.registerTool, AgentTool).
 */
import { CuaClient } from "./src/cua-client.js";
import { createCuaTools } from "./src/tools.js";
import type { PluginApi } from "./src/openclaw-types.js";

const TOOL_NAMES = [
  "key",
  "key_down",
  "key_up",
  "type",
  "hold_key",
  "mouse_move",
  "click",
  "drag",
  "mouse_down",
  "mouse_up",
  "scroll",
  "wait",
  "screenshot",
  "cursor_position",
] as const;

export default function register(api: PluginApi): void {
  const cfg = (api.pluginConfig ?? {}) as { serverUrl?: string };
  const serverUrl = cfg.serverUrl ?? "http://localhost:5000";

  const client = new CuaClient(serverUrl);
  const tools = createCuaTools(client);

  for (const tool of tools) {
    api.registerTool(tool, { optional: true });
  }
}

// --selftest mode: invoked as `node dist/index.cjs --selftest` to verify
// the build artifact is loadable and all tools are present. Does not call
// the CUA server.
if (process.argv.includes("--selftest")) {
  const captured: string[] = [];
  const fakeApi: PluginApi = {
    pluginConfig: { serverUrl: "http://localhost:5000" },
    registerTool: (tool) => captured.push(tool.name),
  };
  register(fakeApi);
  const missing = TOOL_NAMES.filter((n) => !captured.includes(n));
  if (missing.length > 0) {
    console.error(`Selftest FAIL — missing tools: ${missing.join(", ")}`);
    process.exit(1);
  }
  if (captured.length !== TOOL_NAMES.length) {
    console.error(
      `Selftest FAIL — registered ${captured.length} tools, expected ${TOOL_NAMES.length}: ${captured.join(", ")}`,
    );
    process.exit(1);
  }
  console.log(`Selftest OK — registered ${captured.length} tools: ${captured.join(", ")}`);
  process.exit(0);
}
