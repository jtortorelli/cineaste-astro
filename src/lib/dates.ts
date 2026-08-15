import { format } from "date-fns";

function utcDate(value: string | Date): Date {
  if (value instanceof Date) {
    return value;
  }
  const asString = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(asString)) {
    return new Date(`${asString.slice(0, 10)}T00:00:00Z`);
  }
  return new Date(value);
}

export function formatDate(
  value: string | Date | null | undefined,
  pattern: string,
): string {
  if (value == null || value === "") {
    return "";
  }
  return format(utcDate(value), pattern);
}

export function releaseYear(
  releaseDate: unknown,
  slug?: string,
): string | null {
  if (releaseDate == null || releaseDate === "") {
    return slug?.match(/-(\d{4})$/)?.[1] ?? null;
  }

  if (typeof releaseDate === "number") {
    const utcDays = releaseDate - 25569;
    return String(new Date(utcDays * 86400000).getUTCFullYear());
  }

  if (releaseDate instanceof Date) {
    return String(releaseDate.getUTCFullYear());
  }

  const asString = String(releaseDate);
  if (/^\d{4}-\d{2}-\d{2}/.test(asString)) {
    return asString.slice(0, 4);
  }

  return slug?.match(/-(\d{4})$/)?.[1] ?? asString.slice(0, 4);
}

export function displayPersonDate(
  dateValue: string | Date | null | undefined,
  resolution?: string,
): string {
  if (!dateValue) {
    return "";
  }
  if (resolution === "year") {
    return formatDate(dateValue, "yyyy");
  }
  if (resolution === "month") {
    return formatDate(dateValue, "MMM yyyy");
  }
  return formatDate(dateValue, "d MMM yyyy");
}

export function lifespan(dob: string | Date, dod: string | Date): number {
  const birth = utcDate(dob);
  const death = utcDate(dod);
  let age = death.getUTCFullYear() - birth.getUTCFullYear();
  const m = death.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && death.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return age;
}

export function personDateRange(p: {
  dob?: string | Date;
  dod?: string | Date | "unknown";
}): string {
  if (p.dob && p.dod && p.dod !== "unknown") {
    return `${utcDate(p.dob).getUTCFullYear()} - ${utcDate(p.dod).getUTCFullYear()}`;
  }
  if (p.dob && !p.dod) {
    return `b.${utcDate(p.dob).getUTCFullYear()}`;
  }
  return "";
}
