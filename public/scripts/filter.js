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

function writeQuery(value) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set("q", value);
  else url.searchParams.delete("q");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function filterElements(writeUrl) {
  const inputValue = searchInput.value.trim();
  if (clearButton) clearButton.hidden = inputValue.length === 0;

  const terms = tokens(inputValue);
  const hasQuery = terms.length > 0;
  let visible = 0;

  filterables.forEach((el) => {
    const raw = el.getAttribute("data-terms") || "";
    const matched = !hasQuery || termsMatch(terms, raw);
    el.style.display = matched ? "" : "none";
    if (matched) visible += 1;

    const note = el.querySelector(".match-note");
    if (!note) return;
    const explanation = matched && hasQuery ? explain(el, terms) : "";
    note.hidden = explanation.length === 0;
    note.textContent = explanation;
  });

  const total = status ? Number(status.dataset.total) : filterables.length;
  const noun = status?.dataset.noun || "results";
  if (status) {
    status.textContent = hasQuery ? `${visible} of ${total}` : `${total} ${noun}`;
  }
  if (empty && results) {
    const none = hasQuery && visible === 0;
    empty.hidden = !none;
    results.hidden = none;
    empty.textContent = none ? `No ${noun} match “${inputValue}”.` : "";
  }

  if (writeUrl) writeQuery(inputValue);
}

if (searchInput) {
  const initialQuery = new URLSearchParams(window.location.search).get("q");
  if (initialQuery) searchInput.value = initialQuery;

  searchInput.addEventListener("input", () => filterElements(true));
  clearButton?.addEventListener("click", () => {
    searchInput.value = "";
    filterElements(true);
    searchInput.focus();
  });

  filterElements(false);
}
