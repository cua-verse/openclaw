/**
 * Minimal local typings for the OpenClaw plugin API surface this package
 * uses. Mirrored from `openclaw/src/plugins/types.ts` to avoid a runtime
 * dependency on the host OpenClaw install. Keep this in sync with the
 * fork's `OpenClawPluginApi.registerTool` signature.
 */

export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image"; data: string; mimeType: string };
export type ToolContent = TextContent | ImageContent;

export type AgentToolResult = {
  content: ToolContent[];
  details?: unknown;
};

export type ToolExecuteFn = (
  toolCallId: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
  onUpdate?: (chunk: unknown) => void,
) => Promise<AgentToolResult>;

export type AgentTool = {
  name: string;
  description: string;
  label: string;
  parameters: unknown;
  execute: ToolExecuteFn;
};

export type RegisterToolOptions = {
  name?: string;
  names?: string[];
  optional?: boolean;
};

export type PluginApi = {
  registerTool: (tool: AgentTool, opts?: RegisterToolOptions) => void;
  pluginConfig?: Record<string, unknown>;
};
