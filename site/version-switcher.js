// Shared by the extension store and theme gallery on every page.
(() => {
  const menu = document.querySelector('.version-switcher');
  if (!menu) return;
  const trigger = menu.querySelector('summary');
  let pinned = false;
  const close = () => { menu.open = false; pinned = false; };
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    pinned = !pinned;
    menu.open = pinned;
  });
  menu.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') menu.open = true;
  });
  menu.addEventListener('pointerleave', () => {
    if (!pinned && !menu.contains(document.activeElement)) close();
  });
  menu.addEventListener('focusout', (event) => {
    if (!menu.contains(event.relatedTarget)) close();
  });
  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target) || event.target.closest('.version-options a')) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      close();
      trigger.focus();
    }
  });
  const dialog = document.querySelector('.version-dialog');
  menu.querySelector('[data-version-unsupported]')?.addEventListener('click', () => {
    close();
    dialog.showModal();
  });
  dialog?.addEventListener('close', () => trigger.focus());
  dialog?.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
})();
