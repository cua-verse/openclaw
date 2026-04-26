/**
 * LiteDesktopActionSpace tool definitions.
 *
 * Mirrors agenthle/orchestration/external/bridges/cua_mcp_server/src/index.js
 * so OpenClaw and CLI agents share one desktop vocabulary. Coordinates are
 * normalized to [0, 1000]; the bridge converts to absolute pixels using the
 * cached CUA-server screen size.
 */
import { Type } from "@sinclair/typebox";

import { CuaClient } from "./cua-client.js";
import { toAbsolute, toNormalized } from "./coordinates.js";
import type { AgentTool } from "./openclaw-types.js";

const KEY_MAP: Record<string, string> = {
  ARROWUP: "up",
  ARROWDOWN: "down",
  ARROWLEFT: "left",
  ARROWRIGHT: "right",
};

function normalizeKey(key: string): string {
  return KEY_MAP[key.toUpperCase()] ?? key.toLowerCase();
}

function textOnly(label: string): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: label }] };
}

const Coordinate = Type.Tuple([Type.Number(), Type.Number()], {
  description: "(x, y) coordinates normalized to [0, 1000].",
});

const Button = Type.Union(
  [Type.Literal("left"), Type.Literal("right"), Type.Literal("middle")],
  { default: "left", description: "Mouse button." },
);

const Clicks = Type.Union(
  [Type.Literal(1), Type.Literal(2), Type.Literal(3)],
  { default: 1, description: "Number of clicks: 1=single, 2=double, 3=triple." },
);

export function createCuaTools(client: CuaClient): AgentTool[] {
  return [
    // ================================================================
    // Keyboard
    // ================================================================
    {
      name: "key",
      description: "On a desktop, press and release keys.",
      label: "Press key",
      parameters: Type.Object({
        keys: Type.Array(Type.String(), { description: "List of keys to press." }),
      }),
      execute: async (_id, params) => {
        const keys = (params.keys as string[]).map(normalizeKey);
        if (keys.length === 1) {
          await client.sendCommand("press_key", { key: keys[0] });
        } else {
          await client.sendCommand("hotkey", { keys });
        }
        return textOnly(`Pressed: ${keys.join("+")}`);
      },
    },
    {
      name: "key_down",
      description: "On a desktop, press keys down without releasing them.",
      label: "Key down",
      parameters: Type.Object({
        keys: Type.Array(Type.String(), { description: "List of keys to press down." }),
      }),
      execute: async (_id, params) => {
        const keys = (params.keys as string[]).map(normalizeKey);
        for (const k of keys) {
          await client.sendCommand("key_down", { key: k });
        }
        return textOnly(`Key down: ${keys.join("+")}`);
      },
    },
    {
      name: "key_up",
      description: "On a desktop, release keys that were previously pressed down.",
      label: "Key up",
      parameters: Type.Object({
        keys: Type.Array(Type.String(), { description: "List of keys to release." }),
      }),
      execute: async (_id, params) => {
        const keys = (params.keys as string[]).map(normalizeKey);
        for (const k of keys) {
          await client.sendCommand("key_up", { key: k });
        }
        return textOnly(`Key up: ${keys.join("+")}`);
      },
    },
    {
      name: "type",
      description: "On a desktop, type text content into the currently focused input field.",
      label: "Type text",
      parameters: Type.Object({
        text: Type.String({ description: "The text content to type." }),
      }),
      execute: async (_id, params) => {
        const text = params.text as string;
        await client.sendCommand("type_text", { text });
        const preview = text.length > 50 ? text.slice(0, 50) + "..." : text;
        return textOnly(`Typed: "${preview}"`);
      },
    },
    {
      name: "hold_key",
      description: "On a desktop, hold keys down for a specified duration.",
      label: "Hold key",
      parameters: Type.Object({
        keys: Type.Array(Type.String(), { description: "List of keys to hold down." }),
        duration: Type.Number({ description: "Duration in seconds." }),
      }),
      execute: async (_id, params) => {
        const keys = (params.keys as string[]).map(normalizeKey);
        const duration = params.duration as number;
        for (const k of keys) {
          await client.sendCommand("key_down", { key: k });
        }
        await new Promise((resolve) => setTimeout(resolve, duration * 1000));
        for (const k of [...keys].reverse()) {
          await client.sendCommand("key_up", { key: k });
        }
        return textOnly(`Held ${keys.join("+")} for ${duration}s`);
      },
    },

    // ================================================================
    // Mouse
    // ================================================================
    {
      name: "mouse_move",
      description: "On a desktop, move the mouse cursor to specified coordinates.",
      label: "Move cursor",
      parameters: Type.Object({ coordinate: Coordinate }),
      execute: async (_id, params) => {
        const coord = params.coordinate as [number, number];
        const { x, y } = await toAbsolute(client, coord);
        await client.sendCommand("move_cursor", { x, y });
        return textOnly(`Moved cursor to [${coord[0]}, ${coord[1]}]`);
      },
    },
    {
      name: "click",
      description: "On a desktop, perform mouse click at specified coordinates.",
      label: "Click",
      parameters: Type.Object({
        coordinate: Type.Optional(Coordinate),
        button: Type.Optional(Button),
        clicks: Type.Optional(Clicks),
      }),
      execute: async (_id, params) => {
        const coord = params.coordinate as [number, number] | undefined;
        const button = (params.button as "left" | "right" | "middle" | undefined) ?? "left";
        const clicks = (params.clicks as 1 | 2 | 3 | undefined) ?? 1;

        let abs: { x: number; y: number } | null = null;
        if (coord) {
          abs = await toAbsolute(client, coord);
        }

        if (clicks === 2 && button === "left") {
          await client.sendCommand("double_click", abs ? { x: abs.x, y: abs.y } : {});
        } else if (button === "middle") {
          if (abs) {
            await client.sendCommand("move_cursor", { x: abs.x, y: abs.y });
          }
          for (let i = 0; i < clicks; i++) {
            await client.sendCommand("mouse_down", { button: "middle" });
            await client.sendCommand("mouse_up", { button: "middle" });
          }
        } else {
          const cmd = button === "right" ? "right_click" : "left_click";
          const args = abs ? { x: abs.x, y: abs.y } : {};
          for (let i = 0; i < clicks; i++) {
            await client.sendCommand(cmd, args);
          }
        }

        const coordLabel = coord ? ` at [${coord[0]}, ${coord[1]}]` : "";
        return textOnly(`Clicked (${button}, ${clicks}x)${coordLabel}`);
      },
    },
    {
      name: "drag",
      description: "On a desktop, drag the mouse from start to end coordinates.",
      label: "Drag",
      parameters: Type.Object({
        coordinate: Coordinate,
        start_coordinate: Type.Optional(Coordinate),
        button: Type.Optional(Button),
      }),
      execute: async (_id, params) => {
        const end = params.coordinate as [number, number];
        const start = params.start_coordinate as [number, number] | undefined;
        const button = (params.button as "left" | "right" | "middle" | undefined) ?? "left";

        if (start) {
          const s = await toAbsolute(client, start);
          await client.sendCommand("move_cursor", { x: s.x, y: s.y });
        }
        const e = await toAbsolute(client, end);
        await client.sendCommand("drag_to", { x: e.x, y: e.y, button });

        const startLabel = start ? `[${start[0]}, ${start[1]}]` : "current";
        return textOnly(
          `Dragged (${button}) from ${startLabel} to [${end[0]}, ${end[1]}]`,
        );
      },
    },
    {
      name: "mouse_down",
      description: "On a desktop, press the mouse button without releasing.",
      label: "Mouse down",
      parameters: Type.Object({ button: Type.Optional(Button) }),
      execute: async (_id, params) => {
        const button = (params.button as "left" | "right" | "middle" | undefined) ?? "left";
        await client.sendCommand("mouse_down", { button });
        return textOnly(`Mouse down: ${button}`);
      },
    },
    {
      name: "mouse_up",
      description: "On a desktop, release the mouse button.",
      label: "Mouse up",
      parameters: Type.Object({ button: Type.Optional(Button) }),
      execute: async (_id, params) => {
        const button = (params.button as "left" | "right" | "middle" | undefined) ?? "left";
        await client.sendCommand("mouse_up", { button });
        return textOnly(`Mouse up: ${button}`);
      },
    },
    {
      name: "scroll",
      description: "On a desktop, scroll in a specified direction by a specified amount.",
      label: "Scroll",
      parameters: Type.Object({
        direction: Type.Union(
          [Type.Literal("up"), Type.Literal("down"), Type.Literal("left"), Type.Literal("right")],
          { description: "The direction to scroll." },
        ),
        amount: Type.Number({ description: "Number of scroll units." }),
        coordinate: Type.Optional(Coordinate),
      }),
      execute: async (_id, params) => {
        const direction = params.direction as "up" | "down" | "left" | "right";
        const amount = params.amount as number;
        const coord = params.coordinate as [number, number] | undefined;

        if (coord) {
          const { x, y } = await toAbsolute(client, coord);
          await client.sendCommand("move_cursor", { x, y });
        }
        await client.sendCommand("scroll_direction", { direction, clicks: amount });
        const pos = coord ? ` at [${coord[0]}, ${coord[1]}]` : "";
        return textOnly(`Scrolled ${direction} ${amount}${pos}`);
      },
    },

    // ================================================================
    // Utility
    // ================================================================
    {
      name: "wait",
      description: "On a desktop, pause execution for a specified duration.",
      label: "Wait",
      parameters: Type.Object({
        duration: Type.Number({ description: "Time in seconds to wait." }),
      }),
      execute: async (_id, params) => {
        const duration = params.duration as number;
        await new Promise((resolve) => setTimeout(resolve, duration * 1000));
        return textOnly(`Waited ${duration}s`);
      },
    },
    {
      name: "screenshot",
      description:
        "On a desktop, take a screenshot. Optionally save the image to a path on the VM.",
      label: "Screenshot",
      parameters: Type.Object({
        save_path: Type.Optional(
          Type.String({
            description:
              "Absolute file path on the VM to save the screenshot (e.g. C:\\\\tmp\\\\shot.png). If omitted, the screenshot is returned as base64 only without saving to disk.",
          }),
        ),
      }),
      execute: async (_id, params) => {
        const savePath = params.save_path as string | undefined;

        if (savePath !== undefined) {
          const lastSep = Math.max(savePath.lastIndexOf("/"), savePath.lastIndexOf("\\"));
          if (lastSep <= 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: invalid save_path "${savePath}" — must be an absolute path with a parent directory.`,
                },
              ],
            };
          }
          const parentDir = savePath.slice(0, lastSep);
          const dirCheck = await client
            .sendCommand("directory_exists", { path: parentDir })
            .catch(() => null);
          if (!dirCheck || !(dirCheck as { exists?: boolean }).exists) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: parent directory "${parentDir}" does not exist on the VM.`,
                },
              ],
            };
          }
        }

        const { base64, mimeType } = await client.screenshot();

        if (savePath !== undefined) {
          await client.sendCommand("write_bytes", { path: savePath, content_b64: base64 });
          return {
            content: [
              { type: "text", text: `Screenshot captured and saved to ${savePath}` },
              { type: "image", data: base64, mimeType },
            ],
          };
        }

        return {
          content: [
            { type: "text", text: "Screenshot captured" },
            { type: "image", data: base64, mimeType },
          ],
        };
      },
    },
    {
      name: "cursor_position",
      description: "On a desktop, get the current cursor position.",
      label: "Cursor position",
      parameters: Type.Object({}),
      execute: async () => {
        const result = await client.sendCommand("get_cursor_position");
        const pos = result.position as { x: number; y: number };
        const norm = await toNormalized(client, pos.x, pos.y);
        return textOnly(`Cursor at [${norm[0]}, ${norm[1]}]`);
      },
    },
  ];
}
