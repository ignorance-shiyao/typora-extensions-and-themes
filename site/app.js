// Home page search and filters. Cards are server-rendered; this only hides them.
(() => {
  const input = document.getElementById("search");
  const cards = [...document.querySelectorAll(".card")];
  const chips = [...document.querySelectorAll(".chip")];
  const count = document.getElementById("count");
  const empty = document.getElementById("empty");
  if (!input) return;

  const params = new URLSearchParams(location.search);
  let filter = params.get("filter") || "all";
  input.value = params.get("q") || "";

  const matches = (card, terms) => {
    if (filter === "none" ? card.dataset.perms !== "none" : filter !== "all" && card.dataset.tier !== filter) return false;
    return terms.every((t) => card.dataset.search.includes(t));
  };

  function update() {
    const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const card of cards) {
      const ok = matches(card, terms);
      card.hidden = !ok;
      if (ok) shown++;
    }
    for (const chip of chips) chip.setAttribute("aria-pressed", String(chip.dataset.filter === filter));
    count.textContent = `${shown} extension${shown === 1 ? "" : "s"}`;
    empty.hidden = shown > 0;
    const next = new URLSearchParams();
    if (input.value) next.set("q", input.value);
    if (filter !== "all") next.set("filter", filter);
    const query = next.toString();
    history.replaceState(null, "", query ? `?${query}` : location.pathname);
  }

  input.addEventListener("input", update);
  for (const chip of chips)
    chip.addEventListener("click", () => {
      filter = chip.dataset.filter;
      update();
    });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== input) {
      event.preventDefault();
      input.focus();
    } else if (event.key === "Escape" && document.activeElement === input) {
      input.value = "";
      update();
    }
  });
  update();
})();
