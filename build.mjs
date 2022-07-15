import { buildSync } from "esbuild";

buildSync({
  bundle: true,
  minify: true,
  format: "esm",
  target: "esnext",
  outfile: "dist/index.js",
  entryPoints: ["src/index.ts"]
});