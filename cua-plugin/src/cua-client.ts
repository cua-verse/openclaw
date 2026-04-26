export type CuaResult = Record<string, unknown> & { success?: boolean; error?: string };

export type ScreenSize = { width: number; height: number };

export class CuaClient {
  readonly serverUrl: string;
  readonly timeout: number;

  constructor(serverUrl = "http://localhost:5000", timeout = 30_000) {
    this.serverUrl = serverUrl.replace(/\/+$/, "");
    this.timeout = timeout;
  }

  async sendCommand(command: string, params: Record<string, unknown> = {}): Promise<CuaResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const resp = await fetch(`${this.serverUrl}/cmd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, params }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`CUA server HTTP ${resp.status}: ${text}`);
      }
      const body = await resp.text();
      let result: CuaResult | null = null;
      for (const line of body.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            result = JSON.parse(line.slice(6));
          } catch {
            // skip malformed SSE line
          }
        }
      }
      if (!result) {
        throw new Error(`No valid response for command '${command}'`);
      }
      if (result.success === false) {
        throw new Error(`Command '${command}' failed: ${result.error ?? "unknown error"}`);
      }
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  async screenshot(): Promise<{ base64: string; mimeType: "image/png" }> {
    const result = await this.sendCommand("screenshot");
    const imageData = result.image_data as string | undefined;
    if (!imageData) {
      throw new Error("Screenshot returned no image data");
    }
    return { base64: imageData, mimeType: "image/png" };
  }

  async getScreenSize(): Promise<ScreenSize> {
    const result = await this.sendCommand("get_screen_size");
    const size = result.size as ScreenSize | undefined;
    if (size) return size;
    return { width: result.width as number, height: result.height as number };
  }
}
