function normalizeString(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function tokens(value) {
  return normalizeString(value).split(/\s+/).filter((term) => term.length > 0);
}

function termsMatch(terms, value) {
  const haystack = tokens(value);
  if (haystack.length === 0) return false;
  return terms.every((term) =>
    haystack.some((piece) => piece.includes(term)),
  );
}

function alternatesFor(el) {
  const raw = el.getAttribute("data-alternates");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item) : [];
  } catch {
    return [];
  }
}

function explain(el, terms) {
  const primary = [el.dataset.primary || "", el.dataset.year || ""].join(" ");
  if (termsMatch(terms, primary)) return "";
  const japanese = el.dataset.japanese || "";
  if (japanese && termsMatch(terms, japanese)) return `aka ${japanese}`;
  const hit = alternatesFor(el).find((alt) => termsMatch(terms, alt));
  return hit ? `aka ${hit}` : "";
}

const searchInput = document.getElementById("default-search");
const filterables = document.querySelectorAll(".filterable");
const status = document.getElementById("search-status");
const empty = document.getElementById("search-empty");
const results = document.getElementById("search-results");
const clearButton = document.getElementById("search-clear");

const filmFilters = document.getElementById("film-filters");
const decadeButtons = filmFilters
  ? [...filmFilters.querySelectorAll("[data-decade]")]
  : [];
const seriesSelect = document.getElementById("series-filter");
const reviewButton = document.getElementById("review-filter");
const filtersToggle = document.getElementById("filters-toggle");
const filterCount = document.getElementById("filter-count");

function selectDecade(selected) {
  decadeButtons.forEach((button) => {
    const on = button === selected;
    button.setAttribute("aria-checked", on ? "true" : "false");
    button.tabIndex = on ? 0 : -1;
  });
}

function setFiltersOpen(open) {
  if (!filmFilters || !filtersToggle) return;
  filmFilters.classList.toggle("is-open", open);
  filtersToggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function currentFilters() {
  const decade =
    decadeButtons.find((button) => button.getAttribute("aria-checked") === "true")
      ?.getAttribute("data-decade") || "";
  return {
    decade,
    series: seriesSelect?.value || "",
    review: reviewButton?.getAttribute("aria-pressed") === "true",
  };
}

function filtersActive(filters) {
  return Boolean(filters.decade || filters.series || filters.review);
}

function cardMatchesFilters(el, filters) {
  if (filters.decade && el.dataset.decade !== filters.decade) return false;
  if (filters.series && el.dataset.series !== filters.series) return false;
  if (filters.review && el.dataset.review !== "true") return false;
  return true;
}

function writeState(query) {
  const url = new URL(window.location.href);
  const filters = currentFilters();
  if (query) url.searchParams.set("q", query);
  else url.searchParams.delete("q");
  if (filmFilters) {
    if (filters.decade) url.searchParams.set("decade", filters.decade);
    else url.searchParams.delete("decade");
    if (filters.series) url.searchParams.set("series", filters.series);
    else url.searchParams.delete("series");
    if (filters.review) url.searchParams.set("review", "1");
    else url.searchParams.delete("review");
  }
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function filterElements(writeUrl) {
  const inputValue = searchInput.value.trim();
  if (clearButton) clearButton.hidden = inputValue.length === 0;

  const terms = tokens(inputValue);
  const hasQuery = terms.length > 0;
  const filters = currentFilters();
  const narrowing = hasQuery || filtersActive(filters);
  let visible = 0;

  filterables.forEach((el) => {
    const raw = el.getAttribute("data-terms") || "";
    const matched =
      (!hasQuery || termsMatch(terms, raw)) && cardMatchesFilters(el, filters);
    el.style.display = matched ? "" : "none";
    if (matched) visible += 1;

    const note = el.querySelector(".match-note");
    if (!note) return;
    const explanation = matched && hasQuery ? explain(el, terms) : "";
    note.hidden = explanation.length === 0;
    note.textContent = explanation;
  });

  if (seriesSelect) seriesSelect.classList.toggle("is-set", Boolean(filters.series));
  if (filterCount) {
    const active = [filters.decade, filters.series, filters.review].filter(Boolean).length;
    filterCount.textContent = active ? ` · ${active}` : "";
  }

  const total = status ? Number(status.dataset.total) : filterables.length;
  const noun = status?.dataset.noun || "results";
  if (status) {
    status.textContent = narrowing ? `${visible} of ${total}` : `${total} ${noun}`;
  }
  if (empty && results) {
    const none = narrowing && visible === 0;
    empty.hidden = !none;
    results.hidden = none;
    empty.textContent = none
      ? hasQuery
        ? `No ${noun} match “${inputValue}”.`
        : `No ${noun} match these filters.`
      : "";
    const altHref = empty.dataset.altHref;
    if (none && hasQuery && altHref) {
      const link = document.createElement("a");
      link.href = `${altHref}?q=${encodeURIComponent(inputValue)}`;
      link.textContent = `Search ${empty.dataset.altNoun || "elsewhere"} instead.`;
      empty.append(" ", link);
    }
  }

  if (writeUrl) writeState(inputValue);
}

if (searchInput) {
  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get("q");
  if (initialQuery) searchInput.value = initialQuery;

  if (filmFilters) {
    const decade = params.get("decade") || "";
    selectDecade(
      decadeButtons.find((button) => button.getAttribute("data-decade") === decade) ||
        decadeButtons[0],
    );
    if (seriesSelect && params.get("series")) seriesSelect.value = params.get("series");
    if (reviewButton) {
      reviewButton.setAttribute(
        "aria-pressed",
        params.get("review") === "1" ? "true" : "false",
      );
    }
    setFiltersOpen(filtersActive(currentFilters()));
    filtersToggle?.addEventListener("click", () => {
      setFiltersOpen(filtersToggle.getAttribute("aria-expanded") !== "true");
    });
    decadeButtons.forEach((button, index) => {
      button.addEventListener("click", () => {
        selectDecade(button);
        filterElements(true);
      });
      button.addEventListener("keydown", (event) => {
        const last = decadeButtons.length - 1;
        const moves = {
          ArrowRight: index === last ? 0 : index + 1,
          ArrowDown: index === last ? 0 : index + 1,
          ArrowLeft: index === 0 ? last : index - 1,
          ArrowUp: index === 0 ? last : index - 1,
          Home: 0,
          End: last,
        };
        if (!(event.key in moves)) return;
        event.preventDefault();
        const next = decadeButtons[moves[event.key]];
        selectDecade(next);
        next.focus();
        filterElements(true);
      });
    });
    seriesSelect?.addEventListener("change", () => filterElements(true));
    reviewButton?.addEventListener("click", () => {
      const on = reviewButton.getAttribute("aria-pressed") === "true";
      reviewButton.setAttribute("aria-pressed", on ? "false" : "true");
      filterElements(true);
    });
  }

  searchInput.addEventListener("input", () => filterElements(true));
  clearButton?.addEventListener("click", () => {
    searchInput.value = "";
    filterElements(true);
    searchInput.focus();
  });

  filterElements(false);
}
