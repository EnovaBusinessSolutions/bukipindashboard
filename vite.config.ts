import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: ".",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
  // 👇 AQUÍ ES DONDE LO CONECTAMOS CON BUKIPIN-SAAS
  build: {
    // salida del build relativa a la carpeta del submódulo
    outDir: "../public/dashboard",
    emptyOutDir: true, // limpia public/dashboard antes de cada build
  },
  // Si más adelante SIEMPRE lo sirves desde /dashboard,
  // puedes descomentar esto:
  // base: "/dashboard/",
}));
