const sdk = window.typora.view;
const status = document.querySelector("#status");
const preview = document.querySelector("#preview");
const select = document.querySelector("#select");
let active;
let snapshot;
let toolbar;

function update(value) {
  const latest = value?.markdown;
  status.hidden = Boolean(latest);
  preview.hidden = !latest;
  select.hidden = !latest;
  if (preview.value !== (latest ?? "")) preview.value = latest ?? "";
  if (toolbar) toolbar.update({ hidden: !latest });
}

async function refresh() {
  const key = active;
  if (!key) return;
  const next = (await sdk.storage.get("outline-preview"))?.[key];
  if (active !== key || next?.stamp === snapshot?.stamp) return;
  snapshot = next;
  update(next);
}

select.addEventListener("click", () => { preview.focus(); preview.select(); });
sdk.onDocument(({ blocks }) => {
  if (sdk.capabilities?.toolbar && !toolbar) {
    toolbar = sdk.Toolbar({
      hidden: true,
      buttons: [sdk.Button({
        id: "copy-branch",
        label: "复制列表",
        role: "copy",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V4H4v12h4"/></svg>',
        onClick: ({ clipboard }) => clipboard.writeText(preview.value),
      })],
    });
  }
  if (blocks[0]?.id === active) return;
  active = blocks[0]?.id;
  snapshot = undefined;
  update();
  void refresh().catch(() => {});
});
setInterval(() => { void refresh().catch(() => {}); }, 450);
