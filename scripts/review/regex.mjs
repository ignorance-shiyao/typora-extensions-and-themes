// Regular expressions in manifests (inline rules, detail view rules, input
// rules) run on every edit. A pattern with a quantifier inside an unbounded
// quantifier, like (a+)+ or (\w*\s?)*, backtracks exponentially on a line
// that almost matches; Typora's time budget then switches the rule off for
// the document. Catch it before it ships.

import { RegExpParser, visitRegExpAST } from "@eslint-community/regexpp";

const parser = new RegExpParser({ ecmaVersion: 2025 });

/** Every regex-looking string in the contributions: [where, pattern, flags]. */
export function manifestPatterns(contributes) {
  const out = [];
  const visit = (value, where) => {
    if (Array.isArray(value)) return value.forEach((v, i) => visit(v, `${where}[${i}]`));
    if (!value || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value)) {
      if (/^(pattern|regex|match)$/i.test(key) && typeof v === "string")
        out.push([`${where}.${key}`, v, typeof value.flags === "string" ? value.flags : ""]);
      else visit(v, `${where}.${key}`);
    }
  };
  visit(contributes ?? {}, "contributes");
  return out;
}

/** Whether `node` can repeat without bound. */
const unbounded = (q) => q.max === Infinity || q.max > 100;

/** The first nested unbounded quantifier in `pattern`, as source text, or null. */
export function nestedQuantifier(pattern, flags = "") {
  let ast;
  try {
    ast = parser.parsePattern(pattern, 0, pattern.length, { unicode: flags.includes("u") || flags.includes("v"), unicodeSets: flags.includes("v") });
  } catch {
    try {
      ast = parser.parsePattern(pattern, 0, pattern.length, { unicode: true });
    } catch {
      return null; // checkManifest reports invalid patterns.
    }
  }
  let found = null;
  const stack = [];
  visitRegExpAST(ast, {
    onQuantifierEnter(node) {
      if (!found && unbounded(node) && stack.length) found = stack[stack.length - 1].raw;
      if (unbounded(node)) stack.push(node);
    },
    onQuantifierLeave(node) {
      if (unbounded(node)) stack.pop();
    },
  });
  return found;
}

export function checkPatterns({ id, manifest, findings }) {
  for (const [where, pattern, flags] of manifestPatterns(manifest.contributes)) {
    const nested = nestedQuantifier(pattern, flags);
    if (nested)
      findings.error("regex/backtracking", id, `${where}: ${nested} repeats a repetition, which can take exponential time on text that almost matches; rewrite it without nesting.`, { file: "typora-extension.json" });
  }
}
