import {
  type FilmRow,
  isTruthy,
  loadCsvBySlug,
  loadFilmsCsv,
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
    if (isTruthy(row.supporting)) {
      supporting.push(entry);
    } else {
      topBilled.push(entry);
    }
  }

  return { topBilled, supporting };
}

let cachedData: {
  films: FilmRow[];
  series: Record<string, { slug: string }[]>;
  credits: Record<string, Record<string, string>[]>;
  staffs: Record<string, Record<string, string>[]>;
  casts: Record<string, Record<string, string>[]>;
} | null = null;

export function getFilmData() {
  if (!cachedData) {
    cachedData = {
      films: loadFilmsCsv(),
      series: loadSeriesByName(),
      credits: loadCsvBySlug("credits"),
      staffs: loadCsvBySlug("staffs"),
      casts: loadCsvBySlug("casts"),
    };
  }
  return cachedData;
}

export function filmRecordFromCsv(slug: string, films: FilmRow[]) {
  return films.find((row) => row.slug === slug) ?? null;
}
