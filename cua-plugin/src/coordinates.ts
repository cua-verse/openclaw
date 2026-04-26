import type { CuaClient, ScreenSize } from "./cua-client.js";

export const COORD_MAX = 1000;

let cachedScreen: ScreenSize | null = null;

export async function getScreenSize(client: CuaClient): Promise<ScreenSize> {
  if (!cachedScreen) {
    cachedScreen = await client.getScreenSize();
  }
  return cachedScreen;
}

export async function toAbsolute(
  client: CuaClient,
  coordinate: [number, number],
): Promise<{ x: number; y: number }> {
  const screen = await getScreenSize(client);
  return {
    x: Math.round((coordinate[0] / COORD_MAX) * screen.width),
    y: Math.round((coordinate[1] / COORD_MAX) * screen.height),
  };
}

export async function toNormalized(
  client: CuaClient,
  absX: number,
  absY: number,
): Promise<[number, number]> {
  const screen = await getScreenSize(client);
  return [
    Math.round((absX / screen.width) * COORD_MAX),
    Math.round((absY / screen.height) * COORD_MAX),
  ];
}
