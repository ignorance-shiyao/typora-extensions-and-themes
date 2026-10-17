// Home page search and tag filter. Cards are server-rendered; this only hides them.
(() => {
  const input = document.getElementById("search");
  const cards = [...document.querySelectorAll(".card")];
  const chips = [...document.querySelectorAll(".chip")];
  const empty = document.getElementById("empty");
  if (!input) return;

  const params = new URLSearchParams(location.search);
  let tag = params.get("tag") || "";
  if (!chips.some((chip) => chip.dataset.tag === tag)) tag = "";
  input.value = params.get("q") || "";

  const matches = (card, terms) => {
    if (tag && !card.dataset.tags.split(" ").includes(tag)) return false;
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
    for (const chip of chips) chip.setAttribute("aria-pressed", String(chip.dataset.tag === tag));
    empty.hidden = shown > 0;
    const next = new URLSearchParams();
    if (input.value) next.set("q", input.value);
    if (tag) next.set("tag", tag);
    const query = next.toString();
    history.replaceState(null, "", query ? `?${query}` : location.pathname);
  }

  // Card footers: one row; pills that do not fit go into the » pill.
  function fitPills(row) {
    const more = row.querySelector(".more");
    const pills = [...row.children].filter((el) => el !== more);
    for (const el of pills) el.hidden = false;
    more.hidden = true;
    if (row.scrollWidth <= row.clientWidth) return;
    more.hidden = false;
    const hidden = [];
    for (let i = pills.length - 1; i > 0 && row.scrollWidth > row.clientWidth; i--) {
      pills[i].hidden = true;
      hidden.unshift(pills[i].textContent);
    }
    more.title = hidden.join(", ");
  }
  const rows = new ResizeObserver((items) => {
    for (const item of items) if (item.contentRect.width) fitPills(item.target);
  });
  for (const row of document.querySelectorAll(".card-foot .pills")) rows.observe(row);

  input.addEventListener("input", update);
  for (const chip of chips)
    chip.addEventListener("click", () => {
      tag = chip.dataset.tag;
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
