import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // 👇 MUY IMPORTANTE para producción en /dashboard
  base: "/dashboard/",

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

  // 👇 Aquí lo conectamos con BUKIPIN-SAAS
  build: {
    // salida del build relativa a la carpeta del submódulo
    outDir: "../public/dashboard",
    emptyOutDir: true, // limpia public/dashboard antes de cada build
  },
}));
