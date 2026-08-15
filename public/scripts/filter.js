function normalizeString(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const searchInput = document.getElementById("default-search");
const filterables = document.querySelectorAll(".filterable");

function filterElements() {
  const inputValue = searchInput.value.trim();

  if (!inputValue) {
    filterables.forEach((el) => {
      el.style.display = "block";
    });
    return;
  }

  const terms = inputValue.split(/\s+/).filter((term) => term.length > 0).map(
    normalizeString,
  );

  if (terms.length === 0) {
    filterables.forEach((el) => {
      el.style.display = "block";
    });
    return;
  }

  filterables.forEach((el) => {
    const elementTermsRaw = el.getAttribute("data-terms").toLowerCase()
      .split(/\s+/);
    const elementTerms = elementTermsRaw.map(normalizeString);

    const allTermsMatch = terms.every((term) =>
      elementTerms.some((elementTerm) => elementTerm.includes(term))
    );
    if (allTermsMatch) {
      el.style.display = "block";
    } else {
      el.style.display = "none";
    }
  });
}

searchInput.addEventListener("input", filterElements);
