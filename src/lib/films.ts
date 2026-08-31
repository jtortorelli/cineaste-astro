import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  type FilmRow,
  type HomeVideoRow,
  isTruthy,
  loadCsvBySlug,
  loadFilmsCsv,
  loadHomeVideosCsv,
  loadSeriesByName,
} from "./csv";
import { releaseYear } from "./dates";

export type StaffGroup = {
  role: string;
  people: {
    name: string;
    slug?: string;
    alias?: string;
    disambig_chars?: string;
  }[];
};

export function staffFromCsv(
  rows: Record<string, string>[],
): StaffGroup[] {
  const groups: StaffGroup[] = [];

  for (const { role, person_display_name, person_slug, person_alias } of rows) {
    const person: StaffGroup["people"][number] = {
      name: person_display_name,
      ...(person_slug ? { slug: person_slug } : {}),
      ...(person_alias ? { alias: person_alias } : {}),
    };

    const last = groups.at(-1);
    if (last && last.role === role) {
      last.people.push(person);
    } else {
      groups.push({ role, people: [person] });
    }
  }

  return groups;
}

export function seriesEntryIsShowcased(seriesEntry: {
  showcased?: boolean | string;
}): boolean {
  const showcased = seriesEntry?.showcased;
  return showcased === true || showcased === "TRUE";
}

function seriesEntryFromFilmRecord(filmRecord: FilmRow | null) {
  if (!filmRecord) return null;

  return {
    slug: filmRecord.slug,
    title: filmRecord.title,
    year: releaseYear(filmRecord.release_date, filmRecord.slug),
    showcased: filmRecord.showcased,
  };
}

export function loadSeriesDataFromCsv(
  seriesName: string | undefined,
  seriesByName: Record<string, { slug: string }[]>,
  basename: string,
  films: FilmRow[],
) {
  const seriesSlugs = seriesName && seriesByName?.[seriesName];
  if (!seriesSlugs) return null;

  const mappedSeriesEntries = seriesSlugs.map(({ slug }) =>
    seriesEntryFromFilmRecord(
      films.find((row) => row.slug === slug) ?? null,
    ) ?? {
      slug,
      title: slug,
      year: releaseYear(null, slug),
      showcased: false,
    },
  );
  const filmSeriesIndex = seriesSlugs.findIndex(({ slug }) => slug === basename);
  if (filmSeriesIndex < 0) return null;

  return {
    seriesTitle: seriesName,
    mappedSeriesEntries,
    filmSeriesIndex,
  };
}

export function getAdjacentSeriesEntry(
  mappedSeriesEntries: ReturnType<
    typeof loadSeriesDataFromCsv
  > extends infer T
    ? T extends { mappedSeriesEntries: infer E }
      ? E
      : never
    : never,
  filmIndex: number,
  offset: number,
) {
  return mappedSeriesEntries[filmIndex + offset] ?? null;
}

export function processRoleName(role: string): string {
  return role
    .replace("-maru", '<span class="italic">-maru</span>')
    .replace("-seijin", '<span class="italic">-seijin</span>')
    .replace("Gôtengô", '<span class="italic">Gôtengô</span>')
    .replace("Eclair", '<span class="italic">Eclair</span>')
    .replace("Karyû", '<span class="italic">Karyû</span>');
}

export type CastEntry = {
  role: string;
  name: string;
  slug?: string;
  avatar_url?: string;
  uncredited?: boolean;
  alias?: string;
  qualifiers?: string;
  character_qualifiers?: string;
  disambig_chars?: string;
  secondary?: CastEntry[];
};

export function castEntryFromCsvRow(row: Record<string, string>): CastEntry {
  const entry: CastEntry = {
    role: row.role,
    name: row.name,
  };

  if (isTruthy(row.showcased) && row.slug) entry.slug = row.slug;
  if (row.avatar_url) entry.avatar_url = row.avatar_url;
  if (isTruthy(row.uncredited)) entry.uncredited = true;
  if (row.alias) entry.alias = row.alias;
  if (row.qualifiers) entry.qualifiers = row.qualifiers;
  if (row.character_qualifiers) {
    entry.character_qualifiers = row.character_qualifiers;
  }

  return entry;
}

export function castFromCsv(rows: Record<string, string>[]) {
  const topBilled: CastEntry[] = [];
  const supporting: CastEntry[] = [];

  for (const row of rows) {
    const entry = castEntryFromCsvRow(row);
    const list = isTruthy(row.supporting) ? supporting : topBilled;
    if (isTruthy(row.secondary)) {
      const parent = list.at(-1);
      if (!parent) {
        throw new Error("secondary cast row has no preceding primary");
      }
      (parent.secondary ??= []).push(entry);
    } else {
      list.push(entry);
    }
  }

  return { topBilled, supporting };
}

export type HomeVideoFilm = {
  slug: string;
  title: string;
  year: string | null;
  showcased: boolean;
};

export type HomeVideoRelease = {
  slug: string;
  title: string;
  format: string;
  publisher: string;
  year: string;
  notes: string;
  artUrl?: string;
  films: HomeVideoFilm[];
};

const ART_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif"] as const;

export function homeVideoHasArt(slug: string): boolean {
  const dir = join(process.cwd(), "public/static/images/home-videos");
  return ART_EXTENSIONS.some((ext) => existsSync(join(dir, `${slug}.${ext}`)));
}

export function homeVideosByFilmSlug(
  rows: HomeVideoRow[],
  films: FilmRow[],
): Record<string, HomeVideoRelease[]> {
  const filmsBySlug = new Map(films.map((film) => [film.slug, film]));
  const releases: HomeVideoRelease[] = [];

  for (const row of rows) {
    const filmSlugs = row.film_slugs
      .split(";")
      .map((slug) => slug.trim())
      .filter(Boolean);

    const releaseFilms = filmSlugs.map((slug) => {
      const film = filmsBySlug.get(slug);
      if (!film) {
        throw new Error(
          `home video "${row.slug}" references unknown film slug "${slug}"`,
        );
      }
      return {
        slug,
        title: film.title,
        year: releaseYear(film.release_date, slug),
        showcased: isTruthy(film.showcased),
      };
    });

    releases.push({
      slug: row.slug,
      title: row.title,
      format: row.format,
      publisher: row.publisher,
      year: row.year,
      notes: row.notes ?? "",
      ...(homeVideoHasArt(row.slug)
        ? { artUrl: `/static/images/home-videos/${row.slug}.webp` }
        : {}),
      films: releaseFilms,
    });
  }

  const byFilm: Record<string, HomeVideoRelease[]> = {};
  for (const release of releases) {
    for (const film of release.films) {
      (byFilm[film.slug] ??= []).push(release);
    }
  }

  for (const list of Object.values(byFilm)) {
    list.sort((a, b) => {
      const year = Number(a.year) - Number(b.year);
      if (year !== 0) return year;
      const format = a.format.localeCompare(b.format);
      if (format !== 0) return format;
      return a.title.localeCompare(b.title);
    });
  }

  return byFilm;
}

let cachedData: {
  films: FilmRow[];
  series: Record<string, { slug: string }[]>;
  credits: Record<string, Record<string, string>[]>;
  staffs: Record<string, Record<string, string>[]>;
  casts: Record<string, Record<string, string>[]>;
  homeVideos: Record<string, HomeVideoRelease[]>;
} | null = null;

export function getFilmData() {
  if (!import.meta.env.DEV && cachedData) {
    return cachedData;
  }
  const films = loadFilmsCsv();
  const data = {
    films,
    series: loadSeriesByName(),
    credits: loadCsvBySlug("credits"),
    staffs: loadCsvBySlug("staffs"),
    casts: loadCsvBySlug("casts"),
    homeVideos: homeVideosByFilmSlug(loadHomeVideosCsv(), films),
  };
  if (!import.meta.env.DEV) {
    cachedData = data;
  }
  return data;
}

export function filmRecordFromCsv(slug: string, films: FilmRow[]) {
  return films.find((row) => row.slug === slug) ?? null;
}
