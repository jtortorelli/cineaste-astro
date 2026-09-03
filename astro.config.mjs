// @ts-check
import { join } from "node:path";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { convertImagesIntegration } from "./scripts/convert-images.ts";

function watchDevData() {
  const csvDir = join(process.cwd(), "src/data");
  const homeVideoImages = join(
    process.cwd(),
    "public/static/images/home-videos",
  );
  return {
    name: "watch-dev-data",
    configureServer(server) {
      server.watcher.add(csvDir);
      server.watcher.add(homeVideoImages);
      const reload = (/** @type {string} */ file) => {
        const normalized = file.replaceAll("\\", "/");
        const csvChanged =
          normalized.endsWith(".csv") && normalized.includes("/src/data/");
        const homeVideoArtChanged = normalized.includes(
          "/static/images/home-videos/",
        );
        if (!csvChanged && !homeVideoArtChanged) return;
        for (const mod of server.moduleGraph.idToModuleMap.values()) {
          const id = mod.id?.replaceAll("\\", "/") ?? "";
          if (
            id.includes("/src/lib/csv") ||
            id.includes("/src/lib/films") ||
            id.includes("/src/pages/films/")
          ) {
            server.moduleGraph.invalidateModule(mod);
          }
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", reload);
      server.watcher.on("add", reload);
      server.watcher.on("unlink", reload);
    },
  };
}

export default defineConfig({
  trailingSlash: "never",
  integrations: [convertImagesIntegration()],
  vite: {
    plugins: [tailwindcss(), watchDevData()],
  },
});
