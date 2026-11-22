(() => {
  const fold = (value) => value.normalize("NFKC").toLowerCase();

  function parseQuery(text) {
    const terms = [];
    for (const word of fold(text).split(/\s+/)) {
      if (!word) continue;
      if (word.startsWith("#")) {
        if (word.length > 1) terms.push({ kind: "tag", value: word.slice(1) });
      } else if (word.startsWith("path:")) {
        if (word.length > 5) terms.push({ kind: "path", value: word.slice(5) });
      } else {
        terms.push({ kind: "name", value: word });
      }
    }
    return terms.length ? terms : null;
  }

  function matchNode(terms, node, info) {
    if (!terms) return true;
    return terms.every(({ kind, value }) => {
      if (kind === "name") return fold(node.name).includes(value);
      if (kind === "path") return Boolean(node.path) && fold(node.path).includes(value);
      return (info?.tags ?? []).some((tag) => fold(tag).includes(value));
    });
  }

  globalThis.graphMatch = { parseQuery, matchNode };
})();
