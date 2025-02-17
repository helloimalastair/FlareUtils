import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	sourcemap: true,
	dts: true,
	clean: true,
	target: "es2020",
	format: "esm",
});
