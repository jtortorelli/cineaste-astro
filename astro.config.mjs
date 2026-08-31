// @ts-check
import { join } from "node:path";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { convertImagesIntegration } from "./scripts/convert-images.ts";

function watchCsvData() {
  return {
    name: "watch-csv-data",
    configureServer(server) {
      server.watcher.add(join(process.cwd(), "src/data"));
      const reload = (/** @type {string} */ file) => {
        const normalized = file.replaceAll("\\", "/");
        if (
          !normalized.endsWith(".csv") ||
          !normalized.includes("/src/data/")
        ) {
          return;
        }
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
    },
  };
}

export default defineConfig({
  trailingSlash: "never",
  integrations: [convertImagesIntegration()],
  vite: {
    plugins: [tailwindcss(), watchCsvData()],
  },
});
