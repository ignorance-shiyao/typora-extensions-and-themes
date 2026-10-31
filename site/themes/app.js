// theme2.typora.io: the Install ▾ menu closes on a click outside, Escape or a pick.

(() => {
  const menu = document.querySelector(".split-menu");
  if (!menu) return;
  document.addEventListener("click", (event) => {
    if (menu.open && (!menu.contains(event.target) || event.target.closest(".menu a"))) menu.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.open) {
      menu.open = false;
      menu.querySelector("summary").focus();
    }
  });
})();
