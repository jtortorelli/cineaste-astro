import {
  isTruthy,
  type FilmRow,
  type OtherWorkRow,
  type OriginalWorkAuthorRow,
} from "./csv";
import { compareReleaseDate, releaseYear } from "./dates";

export type SelectedWorkRole = {
  name: string;
  episode_count?: number;
  actor_alias?: string;
  qualifiers?: string[];
  uncredited?: boolean;
};

export type SelectedWorkStaff = {
  role: string;
  staff_alias?: string;
  episode_count?: number;
};

export type SelectedWork = {
  format: string;
  title: string;
  year?: string;
  slug?: string;
  poster_url?: string;
  staff?: SelectedWorkStaff[];
  roles?: SelectedWorkRole[];
  kaiju_roles?: SelectedWorkRole[];
};

export type SelectedWorksCatalog = {
  films: FilmRow[];
  casts: Record<string, Record<string, string>[]>;
  staffs: Record<string, Record<string, string>[]>;
  kaiju: Record<string, Record<string, string>[]>;
  originalWorkAuthors: OriginalWorkAuthorRow[];
  otherWorks: OtherWorkRow[];
};

function splitSemi(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseEpisodeCount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

type Card = {
  format: string;
  title: string;
  slug?: string;
  poster_url?: string;
  release_date: string;
  staff: SelectedWorkStaff[];
  roles: SelectedWorkRole[];
  kaiju_roles: SelectedWorkRole[];
  staffNames: Set<string>;
  roleNames: Set<string>;
};

function addStaff(card: Card, staff: SelectedWorkStaff) {
  if (!staff.role || card.staffNames.has(staff.role)) return;
  card.staffNames.add(staff.role);
  card.staff.push(staff);
}

function addRole(card: Card, role: SelectedWorkRole, kaiju = false) {
  if (!role.name) return;
  if (card.roleNames.has(role.name)) return;
  card.roleNames.add(role.name);
  if (kaiju) card.kaiju_roles.push(role);
  else card.roles.push(role);
}

function filmCardKey(slug: string) {
  return `film:${slug}`;
}

function otherCardKey(format: string, title: string) {
  return `other:${format}:${title}`;
}

export function selectedWorksFor(
  personSlug: string,
  catalog: SelectedWorksCatalog,
): SelectedWork[] {
  const filmBySlug = new Map(catalog.films.map((film) => [film.slug, film]));
  const cards = new Map<string, Card>();

  function ensureFilmCard(film: FilmRow): Card {
    const key = filmCardKey(film.slug);
    const existing = cards.get(key);
    if (existing) return existing;
    const card: Card = {
      format: "film",
      title: film.title,
      slug: film.slug,
      poster_url: film.poster_url || undefined,
      release_date: film.release_date,
      staff: [],
      roles: [],
      kaiju_roles: [],
      staffNames: new Set(),
      roleNames: new Set(),
    };
    cards.set(key, card);
    return card;
  }

  for (const [filmSlug, rows] of Object.entries(catalog.kaiju)) {
    const film = filmBySlug.get(filmSlug);
    if (!film) continue;
    for (const row of rows) {
      if (row.person_slug !== personSlug) continue;
      addRole(
        ensureFilmCard(film),
        {
          name: row.monster,
          ...(row.person_alias ? { actor_alias: row.person_alias } : {}),
          ...(row.portrayal_type ? { qualifiers: [row.portrayal_type] } : {}),
        },
        true,
      );
    }
  }

  for (const [filmSlug, rows] of Object.entries(catalog.casts)) {
    const film = filmBySlug.get(filmSlug);
    if (!film) continue;
    for (const row of rows) {
      if (row.slug !== personSlug) continue;
      const qualifiers = splitSemi(row.qualifiers);
      addRole(ensureFilmCard(film), {
        name: row.role,
        ...(row.alias ? { actor_alias: row.alias } : {}),
        ...(qualifiers.length ? { qualifiers } : {}),
        ...(isTruthy(row.uncredited) ? { uncredited: true } : {}),
      });
    }
  }

  for (const [filmSlug, rows] of Object.entries(catalog.staffs)) {
    const film = filmBySlug.get(filmSlug);
    if (!film) continue;
    for (const row of rows) {
      if (row.person_slug !== personSlug) continue;
      addStaff(ensureFilmCard(film), {
        role: row.role,
        ...(row.person_alias ? { staff_alias: row.person_alias } : {}),
      });
    }
  }

  const authored = catalog.originalWorkAuthors.filter(
    (author) => author.person_slug === personSlug,
  );
  if (authored.length > 0) {
    for (const film of catalog.films) {
      const workSlugs = new Set(splitSemi(film.original_work_slugs));
      for (const author of authored) {
        if (!workSlugs.has(author.work_slug)) continue;
        addStaff(ensureFilmCard(film), { role: author.credit });
      }
    }
  }

  for (const row of catalog.otherWorks) {
    if (row.person_slug !== personSlug) continue;
    let card: Card;
    if (row.film_slug) {
      const film = filmBySlug.get(row.film_slug);
      if (!film) {
        throw new Error(
          `other-works references unknown film "${row.film_slug}"`,
        );
      }
      card = ensureFilmCard(film);
    } else {
      const key = otherCardKey(row.format, row.title);
      const existing = cards.get(key);
      if (existing) {
        card = existing;
      } else {
        card = {
          format: row.format || "film",
          title: row.title,
          poster_url: row.art_url || undefined,
          release_date: row.release_date,
          staff: [],
          roles: [],
          kaiju_roles: [],
          staffNames: new Set(),
          roleNames: new Set(),
        };
        cards.set(key, card);
      }
    }

    const qualifiers = splitSemi(row.qualifiers);
    const episode_count = parseEpisodeCount(row.episode_count);
    const credit = {
      name: row.credit,
      ...(row.alias ? { actor_alias: row.alias } : {}),
      ...(qualifiers.length ? { qualifiers } : {}),
      ...(isTruthy(row.uncredited) ? { uncredited: true } : {}),
      ...(episode_count ? { episode_count } : {}),
    };
    if (row.kind === "staff") {
      addStaff(card, {
        role: row.credit,
        ...(row.alias ? { staff_alias: row.alias } : {}),
        ...(episode_count ? { episode_count } : {}),
      });
    } else if (row.kind === "kaiju") {
      addRole(card, credit, true);
    } else if (row.kind === "role" || row.credit) {
      addRole(card, credit);
    }
  }

  return [...cards.values()]
    .map((card) => ({
      card,
      sort: {
        release_date: card.release_date,
        slug: card.slug ?? card.title,
      },
    }))
    .sort((a, b) => compareReleaseDate(a.sort, b.sort))
    .map(({ card }) => {
      const year = releaseYear(card.release_date, card.slug) ?? undefined;
      return {
        format: card.format,
        title: card.title,
        ...(year ? { year } : {}),
        ...(card.slug ? { slug: card.slug } : {}),
        ...(card.poster_url ? { poster_url: card.poster_url } : {}),
        ...(card.staff.length ? { staff: card.staff } : {}),
        ...(card.roles.length ? { roles: card.roles } : {}),
        ...(card.kaiju_roles.length ? { kaiju_roles: card.kaiju_roles } : {}),
      };
    });
}
