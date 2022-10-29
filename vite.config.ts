/// <reference types="vitest" />
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  build: {
    lib: {
      entry: "./src/lib.ts",
      formats: ["es"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["test/*.test.ts"],
  },
});
