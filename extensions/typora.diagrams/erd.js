// erd (https://github.com/BurntSushi/erd) → Graphviz DOT.
//
//   title {label: "Library"}
//   [Person] {bgcolor: "#d0e0d0"}
//   *id
//   name {label: "varchar"}
//   +address_id
//
//   [Address]
//   *id
//
//   Person *--1 Address {label: "lives at"}
//
// `*` marks a primary key, `+` a foreign key. Cardinalities: `?` 0 or 1,
// `1` exactly one, `*` 0 or more, `+` 1 or more.

(() => {
  const CARDINALITY = { "?": "0..1", 1: "1", "*": "0..N", "+": "1..N" };
  // A name: `quoted`, 'quoted', "quoted" or a bare word.
  const NAME = String.raw`(?:\x60[^\x60]*\x60|'[^']*'|"[^"]*"|[^\s{}\[\]]+)`;
  const ENTITY = /^\[([^\]]+)\]\s*(\{.*\})?$/;
  const RELATIONSHIP = new RegExp(String.raw`^(${NAME})\s+([?1*+])--([?1*+])\s+(${NAME})\s*(\{.*\})?$`);
  const ATTRIBUTE = new RegExp(String.raw`^([*+]{0,2})\s*(${NAME})\s*(\{.*\})?$`);
  const DIRECTIVE = /^(title|entity|header|relationship)\s*(\{.*\})$/;

  const unquote = (name) => (/^([`'"]).*\1$/.test(name) ? name.slice(1, -1) : name);
  const html = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const dotString = (text) => `"${String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;

  /** `{label: "x", size: "20"}` → { label: "x", size: "20" }. */
  function options(text, line) {
    const out = {};
    if (!text) return out;
    const body = text.trim().slice(1, -1).trim();
    if (!body) return out;
    const pattern = /\s*([A-Za-z-]+)\s*:\s*("(?:[^"\\]|\\.)*"|'[^']*'|[^,]+?)\s*(?:,|$)/y;
    let index = 0;
    while (index < body.length) {
      pattern.lastIndex = index;
      const match = pattern.exec(body);
      if (!match) throw new Error(`Line ${line}: cannot read the options ${text}.`);
      const raw = match[2];
      out[match[1].toLowerCase()] = /^"/.test(raw) ? JSON.parse(raw) : unquote(raw);
      index = pattern.lastIndex;
    }
    return out;
  }

  function parse(source) {
    const doc = { title: null, defaults: { entity: {}, header: {}, relationship: {} }, entities: [], relationships: [] };
    let entity = null;
    source.split(/\r?\n/).forEach((raw, i) => {
      const line = raw.trim();
      const number = i + 1;
      if (!line || line.startsWith("#")) return;
      let match;
      if ((match = DIRECTIVE.exec(line)) && !entity && !doc.entities.length) {
        if (match[1] === "title") doc.title = options(match[2], number);
        else doc.defaults[match[1]] = options(match[2], number);
      } else if ((match = ENTITY.exec(line))) {
        entity = { name: unquote(match[1].trim()), options: options(match[2], number), attributes: [] };
        doc.entities.push(entity);
      } else if ((match = RELATIONSHIP.exec(line))) {
        doc.relationships.push({
          from: unquote(match[1]),
          fromCard: match[2],
          toCard: match[3],
          to: unquote(match[4]),
          options: options(match[5], number),
        });
      } else if ((match = ATTRIBUTE.exec(line)) && entity) {
        entity.attributes.push({
          name: unquote(match[2]),
          primary: match[1].includes("*"),
          foreign: match[1].includes("+"),
          options: options(match[3], number),
        });
      } else {
        throw new Error(`Line ${number}: expected [Entity], an attribute or a relationship like "A *--1 B".`);
      }
    });
    if (!doc.entities.length) throw new Error("No entities. Declare one with [Name].");
    const names = new Set(doc.entities.map((e) => e.name));
    for (const r of doc.relationships) {
      for (const name of [r.from, r.to]) if (!names.has(name)) throw new Error(`Unknown entity ${name} in a relationship.`);
    }
    return doc;
  }

  function fontAttributes(o, fallbackSize) {
    const parts = [];
    if (o.font) parts.push(`FACE="${html(o.font)}"`);
    if (o.size || fallbackSize) parts.push(`POINT-SIZE="${html(o.size || fallbackSize)}"`);
    if (o.color) parts.push(`COLOR="${html(o.color)}"`);
    return parts.join(" ");
  }

  function entityLabel(entity, defaults, theme) {
    const o = { ...defaults.entity, ...entity.options };
    const header = { ...defaults.header, ...entity.options };
    const border = o["border-color"] || theme.foreground;
    const rows = [];
    const headerFont = fontAttributes(header, 16);
    const headerBg = header.bgcolor || o.bgcolor || theme.panel;
    rows.push(
      `<TR><TD BGCOLOR="${html(headerBg)}"><FONT ${headerFont}><B>${html(entity.options.label || entity.name)}</B></FONT></TD></TR>`,
    );
    for (const attribute of entity.attributes) {
      let text = html(attribute.name);
      if (attribute.primary) text = `<U>${text}</U>`;
      if (attribute.foreign) text = `<I>${text}</I>`;
      if (attribute.options.label) text += ` [${html(attribute.options.label)}]`;
      const font = fontAttributes({ ...o, ...attribute.options, size: attribute.options.size || o.size });
      const bg = attribute.options.bgcolor || o.bgcolor;
      rows.push(`<TR><TD ALIGN="LEFT"${bg ? ` BGCOLOR="${html(bg)}"` : ""}>${font ? `<FONT ${font}>${text}</FONT>` : text}</TD></TR>`);
    }
    const borderWidth = o.border === undefined ? 1 : Number(o.border) || 0;
    return `<<TABLE BORDER="${borderWidth}" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" COLOR="${html(border)}">${rows.join("")}</TABLE>>`;
  }

  /** The DOT for an erd source. Throws with a line number on bad input. */
  function erdToDot(source, theme) {
    const doc = parse(source);
    const out = ["graph erd {"];
    const graph = [`fontcolor=${dotString(theme.foreground)}`];
    if (doc.title) {
      graph.push(`label=${dotString(doc.title.label ?? "")}`, "labelloc=t");
      if (doc.title.size) graph.push(`fontsize=${dotString(doc.title.size)}`);
      if (doc.title.font) graph.push(`fontname=${dotString(doc.title.font)}`);
      if (doc.title.color) graph.push(`fontcolor=${dotString(doc.title.color)}`);
    }
    out.push(`  graph [${graph.join(", ")}];`);
    out.push(`  node [shape=plaintext, margin=0, fontcolor=${dotString(theme.foreground)}];`);
    out.push(`  edge [color=${dotString(theme.foreground)}, fontcolor=${dotString(theme.foreground)}, labeldistance=2, labelangle=30];`);
    for (const entity of doc.entities) out.push(`  ${dotString(entity.name)} [label=${entityLabel(entity, doc.defaults, theme)}];`);
    for (const r of doc.relationships) {
      const o = { ...doc.defaults.relationship, ...r.options };
      const attrs = [`taillabel=${dotString(CARDINALITY[r.fromCard])}`, `headlabel=${dotString(CARDINALITY[r.toCard])}`];
      if (o.label) attrs.push(`label=${dotString(o.label)}`);
      if (o.color) attrs.push(`color=${dotString(o.color)}`);
      if (o.size) attrs.push(`fontsize=${dotString(o.size)}`);
      if (o.font) attrs.push(`fontname=${dotString(o.font)}`);
      out.push(`  ${dotString(r.from)} -- ${dotString(r.to)} [${attrs.join(", ")}];`);
    }
    out.push("}");
    return out.join("\n");
  }

  self.erdToDot = erdToDot;
})();
