import { readFileSync } from "node:fs";
import { join } from "node:path";

const ICONS_DIR = join(process.cwd(), "src/icons");

function iconPath(
  name: string,
  set: "tabler" | "simpleicons",
  variant?: string,
): string {
  if (set === "simpleicons") {
    return join(ICONS_DIR, "simpleicons", `${name}.svg`);
  }
  const suffix = variant ? `-${variant}` : "-outline";
  return join(ICONS_DIR, "tabler", `${name}${suffix}.svg`);
}

export function getIconHtml(
  name: string,
  set: "tabler" | "simpleicons" = "tabler",
  variant = "outline",
  className = "",
): string {
  const path = iconPath(name, set, set === "tabler" ? variant : undefined);
  let svg = readFileSync(path, "utf8");
  if (className) {
    svg = svg.replace(/class="([^"]*)"/, (_, existing) =>
      `class="${existing} ${className}"`.trim()
    );
  }
  return svg;
}
