import {
  existsSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import sharp from "sharp";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PUBLIC_IMAGES = join(ROOT, "public/static/images");
const RASTER_EXT = new Set([".jpg", ".jpeg", ".png", ".avif"]);
const SOURCE_EXT = new Set([...RASTER_EXT, ".webp"]);

type ResizeRule =
  | { width: number; height: number; fit: keyof sharp.FitEnum }
  | { width: number };

function resizeRule(rel: string): ResizeRule | null {
  const path = rel.replaceAll("\\", "/");
  if (path.startsWith("films/posters/")) {
    return { width: 270, height: 400, fit: "cover" };
  }
  if (/^people\/[^/]+\/avatar\./.test(path)) {
    return { width: 200, height: 200, fit: "cover" };
  }
  if (path.includes("/cast-avatars/") || path.includes("/kaiju-avatars/")) {
    return { width: 150, height: 150, fit: "cover" };
  }
  if (path.startsWith("home-videos/")) {
    return { width: 120 };
  }
  if (path.startsWith("tv-series/title-cards/") || path.startsWith("books/")) {
    return { width: 270 };
  }
  return null;
}

function walkSourceImages(
  dir: string,
  exts: Set<string> = SOURCE_EXT,
): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkSourceImages(path, exts));
      continue;
    }
    if (exts.has(extname(entry.name).toLowerCase())) {
      results.push(path);
    }
  }
  return results;
}

function webpPath(source: string): string {
  return source.replace(/\.(jpe?g|png|avif)$/i, ".webp");
}

function applyResize(source: string, rel: string) {
  const rule = resizeRule(rel);
  let pipeline = sharp(source);
  if (rule && "height" in rule) {
    pipeline = pipeline.resize(rule.width, rule.height, { fit: rule.fit });
  } else if (rule) {
    pipeline = pipeline.resize({ width: rule.width });
  }
  return pipeline.webp();
}

async function alreadySized(file: string, rule: ResizeRule): Promise<boolean> {
  const { width, height } = await sharp(file).metadata();
  if (!width) return false;
  if ("height" in rule) {
    return width === rule.width && height === rule.height;
  }
  return width === rule.width;
}

async function convertFile(source: string, imagesRoot: string): Promise<void> {
  const rel = relative(imagesRoot, source);
  const dest = webpPath(source);
  const rule = resizeRule(rel);
  const inPlace = dest === source;

  if (inPlace) {
    if (!rule || (await alreadySized(source, rule))) return;
    writeFileSync(dest, await applyResize(source, rel).toBuffer());
    return;
  }

  if (
    existsSync(dest) &&
    statSync(dest).mtimeMs >= statSync(source).mtimeMs &&
    (!rule || (await alreadySized(dest, rule)))
  ) {
    return;
  }

  await applyResize(source, rel).toFile(dest);
}

export async function convertImagesInDir(imagesDir: string): Promise<void> {
  const sources = walkSourceImages(imagesDir);
  const raster = sources.filter((path) =>
    RASTER_EXT.has(extname(path).toLowerCase()),
  );
  const webps = sources.filter(
    (path) => extname(path).toLowerCase() === ".webp",
  );
  for (const source of raster) {
    await convertFile(source, imagesDir);
  }
  for (const source of webps) {
    await convertFile(source, imagesDir);
  }
}

export function stripSourceImages(imagesDir: string): void {
  for (const source of walkSourceImages(imagesDir, RASTER_EXT)) {
    unlinkSync(source);
  }
}

function sourceBesideWebp(webpFile: string): string | null {
  const base = webpFile.replace(/\.webp$/i, "");
  for (const ext of [".jpg", ".jpeg", ".png", ".avif"] as const) {
    const candidate = `${base}${ext}`;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const devCache = new Map<string, { mtimeMs: number; body: Buffer }>();
const needCache = new Map<string, { mtimeMs: number; needs: boolean }>();

async function webpFromSource(source: string): Promise<Buffer> {
  const mtimeMs = statSync(source).mtimeMs;
  const cached = devCache.get(source);
  if (cached && cached.mtimeMs === mtimeMs) return cached.body;
  const rel = relative(PUBLIC_IMAGES, source);
  const body = await applyResize(source, rel).toBuffer();
  devCache.set(source, { mtimeMs, body });
  return body;
}

async function publicWebpNeedsTransform(file: string): Promise<boolean> {
  const mtimeMs = statSync(file).mtimeMs;
  const cached = needCache.get(file);
  if (cached && cached.mtimeMs === mtimeMs) return cached.needs;
  const rel = relative(PUBLIC_IMAGES, file);
  const rule = resizeRule(rel);
  const needs = !!rule && !(await alreadySized(file, rule));
  needCache.set(file, { mtimeMs, needs });
  return needs;
}

export function convertImagesIntegration(): AstroIntegration {
  return {
    name: "convert-images",
    hooks: {
      "astro:server:setup": ({ server }) => {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url?.split("?")[0] ?? "";
          if (!url.startsWith("/static/images/") || !url.endsWith(".webp")) {
            next();
            return;
          }
          const publicWebp = join(ROOT, "public", decodeURIComponent(url));
          const rasterSource = sourceBesideWebp(publicWebp);
          const source =
            rasterSource ??
            (existsSync(publicWebp) &&
            (await publicWebpNeedsTransform(publicWebp))
              ? publicWebp
              : null);
          if (!source) {
            next();
            return;
          }
          try {
            const body = await webpFromSource(source);
            res.setHeader("Content-Type", "image/webp");
            res.end(body);
          } catch (error) {
            next(error);
          }
        });
      },
      "astro:build:done": async ({ dir }) => {
        const imagesDir = join(fileURLToPath(dir), "static/images");
        await convertImagesInDir(imagesDir);
        stripSourceImages(imagesDir);
      },
    },
  };
}

if (import.meta.main) {
  const distImages = join(ROOT, "dist/static/images");
  if (!existsSync(distImages)) {
    console.error("No dist/static/images. Conversion runs during astro build.");
    process.exit(1);
  }
  await convertImagesInDir(distImages);
  stripSourceImages(distImages);
}
