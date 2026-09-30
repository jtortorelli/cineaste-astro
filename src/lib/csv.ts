import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { parse } from "csv-parse/sync";

const DATA_DIR = join(process.cwd(), "src/data");

function parseCsvFile(path: string): Record<string, string>[] {
  const text = readFileSync(path, "utf8");
  return parse(text, {
    columns: true,
    skip_empty_lines: false,
    relax_column_count: true,
  }) as Record<string, string>[];
}

export type FilmRow = {
  slug: string;
  showcased: string;
  title: string;
  series_name: string;
  release_date: string;
  japanese_title: string;
  url: string;
  runtime: string;
  poster_url: string;
  transliteration: string;
  translation: string;
  aliases_json: string;
};

export function loadFilmsCsv(): FilmRow[] {
  return parseCsvFile(join(DATA_DIR, "films.csv")) as FilmRow[];
}

export function loadSeriesByName(): Record<string, { slug: string }[]> {
  const dir = join(DATA_DIR, "series");
  const result: Record<string, { slug: string }[]> = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".csv")) continue;
    const name = basename(file, ".csv");
    const rows = parseCsvFile(join(dir, file));
    result[name] = rows
      .filter((row) => row.slug)
      .map((row) => ({ slug: row.slug }));
  }
  return result;
}

export function loadCsvBySlug(
  subdir: "credits" | "staffs" | "casts",
): Record<string, Record<string, string>[]> {
  const dir = join(DATA_DIR, subdir);
  const result: Record<string, Record<string, string>[]> = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".csv")) continue;
    const slug = basename(file, ".csv");
    result[slug] = parseCsvFile(join(dir, file));
  }
  return result;
}

export function isTruthy(value: unknown): boolean {
  return value === true || value === "TRUE" || value === "true";
}

export type HomeVideoRow = {
  slug: string;
  title: string;
  format: string;
  publisher: string;
  year: string;
  film_slugs: string;
  notes: string;
};

export function loadHomeVideosCsv(): HomeVideoRow[] {
  return parseCsvFile(join(DATA_DIR, "home-videos.csv")).filter(
    (row) => row.slug,
  ) as HomeVideoRow[];
}

export type AccoladeRow = {
  person_slug: string;
  status: string;
  ceremony: string;
  category: string;
  films: string;
  film_slugs: string;
};

export function loadAccoladesCsv(): AccoladeRow[] {
  return parseCsvFile(join(DATA_DIR, "accolades.csv")).filter(
    (row) => row.person_slug,
  ) as AccoladeRow[];
}
