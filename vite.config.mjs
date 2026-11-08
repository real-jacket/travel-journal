import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { trips, renderTripLinks } from "./src/data/trips.js";

// Serve public/trips/<slug>/index.html for directory URLs instead of the SPA fallback.
const tripPages = (server) => {
  server.middlewares.use((req, res, next) => {
    const [path, query = ""] = req.url.split("?");
    const match = /^(.*\/trips\/([\w-]+))(\/?)$/.exec(path);
    if (!match || !existsSync(fileURLToPath(new URL(`./public/trips/${match[2]}/index.html`, import.meta.url)))) return next();
    const search = query && `?${query}`;
    if (match[3]) req.url = `${path}index.html${search}`;
    else return void res.writeHead(302, { Location: `${path}/${search}` }).end();
    next();
  });
};

export default defineConfig({
  base: "/travel-journal/",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), tailwindcss(), {
    name: "travel-links",
    transformIndexHtml: (html) => html.replace("<!-- TRAVEL_LINKS -->", renderTripLinks(trips)),
    configureServer: tripPages,
    configurePreviewServer: tripPages,
  }],
});
