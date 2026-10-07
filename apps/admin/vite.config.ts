import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build:demo` genera un único HTML autocontenido con datos de ejemplo
// (docs/admin-demo.html) para revisar la app sin backend.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "demo" ? [viteSingleFile()] : [])],
  build: mode === "demo"
    ? { outDir: "../../docs/admin-demo", emptyOutDir: true }
    : { outDir: "dist" },
  define: mode === "demo" ? { "import.meta.env.VITE_MODO_DEMO": JSON.stringify("1") } : {},
}));
