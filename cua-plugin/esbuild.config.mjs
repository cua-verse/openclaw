import { build } from "esbuild";

await build({
  entryPoints: ["index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: "dist/index.cjs",
  sourcemap: false,
  minify: false,
  external: [],
  banner: {
    js: "/* OpenClaw CUA plugin (LiteDesktopActionSpace bridge). Built by esbuild. */",
  },
});

console.log("Built dist/index.cjs");
