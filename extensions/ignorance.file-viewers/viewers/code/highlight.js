// Syntax highlighting for the code viewer. One pass of a combined regular expression per language,
// no dependencies. The output keeps every character of the source (text is only wrapped in spans),
// so it can sit under the transparent textarea without shifting the caret.
(function () {
  const words = (list) => `\\b(?:${list.trim().split(/\s+/).join("|")})\\b`;
  const DQ = String.raw`"(?:\\[\s\S]|[^"\\\n])*"`;
  const SQ = String.raw`'(?:\\[\s\S]|[^'\\\n])*'`;
  const TPL = String.raw`\`(?:\\[\s\S]|[^\`\\])*\``;
  const NUM = String.raw`\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)[a-zA-Z]*\b`;
  const CALL = String.raw`\b[A-Za-z_$][\w$]*(?=\s*\()`;
  const TYPE = String.raw`\b[A-Z][A-Za-z0-9_]*\b`;
  const BLOCK_COMMENT = String.raw`\/\*[\s\S]*?\*\/`;
  const LINE_COMMENT = String.raw`\/\/[^\n]*`;

  const KEYWORDS = {
    js: "async await break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield as get set",
    ts: "abstract declare enum implements interface keyof namespace private protected public readonly type is satisfies infer unknown never any string number boolean object symbol bigint",
    python: "and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case self cls",
    java: "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while var record sealed permits",
    go: "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var string int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float32 float64 bool byte rune error any",
    rust: "as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str",
    c: "auto break case char class const constexpr continue default delete do double else enum explicit extern float for friend goto if inline int long namespace new noexcept operator private protected public register return short signed sizeof static struct switch template this throw try catch typedef typename union unsigned using virtual void volatile while bool nullptr override final",
    shell: "if then elif else fi for while until do done in case esac function select return exit break continue local export readonly declare unset shift source alias echo cd test",
    sql: "select from where group by order having insert into values update set delete create alter drop table index view database join inner outer left right full cross on as and or not in is like between exists distinct union all limit offset case when then else end primary key foreign references default unique check constraint with begin commit rollback asc desc count sum avg min max",
  };
  const LITERALS = "true false null undefined NaN Infinity None True False nil NULL iota";

  // Each language is a list of [class, pattern] pairs, tried in order at every position.
  const RULES = {};
  const clike = (extra, strings = `${DQ}|${SQ}|${TPL}`) => [
    ["c-cm", BLOCK_COMMENT],
    ["c-cm", LINE_COMMENT],
    ["c-str", strings],
    ...extra,
    ["c-attr", String.raw`@[A-Za-z_][\w.]*`],
    ["c-num", NUM],
    ["c-num", words(LITERALS)],
    ["c-fn", CALL],
    ["c-type", TYPE],
  ];
  RULES.js = clike([["c-kw", words(KEYWORDS.js)]]);
  RULES.ts = clike([["c-kw", words(`${KEYWORDS.js} ${KEYWORDS.ts}`)]]);
  RULES.java = clike([["c-kw", words(KEYWORDS.java)]]);
  RULES.go = clike([["c-kw", words(KEYWORDS.go)]]);
  RULES.rust = clike([["c-attr", String.raw`#!?\[[^\]\n]*\]`], ["c-kw", words(KEYWORDS.rust)]], String.raw`${DQ}|'(?:\\.|[^'\\\n])'`);
  RULES.c = clike([["c-attr", String.raw`^[ \t]*#[ \t]*\w+`], ["c-str", String.raw`<[\w./]+\.h>`], ["c-kw", words(KEYWORDS.c)]]);
  RULES.python = [
    ["c-cm", String.raw`#[^\n]*`],
    ["c-str", String.raw`"""[\s\S]*?"""|'''[\s\S]*?'''|${DQ}|${SQ}`],
    ["c-attr", String.raw`^[ \t]*@[A-Za-z_][\w.]*`],
    ["c-kw", words(KEYWORDS.python)],
    ["c-num", NUM],
    ["c-num", words(LITERALS)],
    ["c-fn", CALL],
    ["c-type", TYPE],
  ];
  RULES.shell = [
    ["c-cm", String.raw`#[^\n]*`],
    ["c-str", `${DQ}|${SQ}`],
    ["c-var", String.raw`\$(?:\{[^}\n]*\}|[\w@#?*$!-]+)`],
    ["c-kw", words(KEYWORDS.shell)],
    ["c-num", NUM],
    ["c-fn", String.raw`\b[A-Za-z_][\w-]*(?=\s*\(\))`],
  ];
  RULES.sql = [
    ["c-cm", String.raw`--[^\n]*|${BLOCK_COMMENT}`],
    ["c-str", SQ],
    ["c-kw", words(KEYWORDS.sql)],
    ["c-num", NUM],
    ["c-num", words(LITERALS)],
    ["c-fn", CALL],
  ];
  RULES.ini = [
    ["c-cm", String.raw`^[ \t]*[;#][^\n]*`],
    ["c-tag", String.raw`^[ \t]*\[[^\]\n]+\]`],
    ["c-attr", String.raw`^[ \t]*[\w.-]+(?=[ \t]*[=:])`],
    ["c-str", `${DQ}|${SQ}`],
    ["c-num", NUM],
    ["c-num", words("true false yes no on off null")],
  ];
  RULES.css = [
    ["c-cm", BLOCK_COMMENT],
    ["c-str", `${DQ}|${SQ}`],
    ["c-kw", String.raw`@[\w-]+`],
    ["c-num", String.raw`#[0-9a-fA-F]{3,8}\b`],
    ["c-num", String.raw`-?\b\d[\d.]*(?:px|em|rem|%|vh|vw|vmin|vmax|ch|s|ms|deg|fr)?`],
    ["c-var", String.raw`--[\w-]+`],
    ["c-attr", String.raw`[\w-]+(?=\s*:(?!:)(?=[^{}]*[;}]))`],
    ["c-fn", String.raw`[\w-]+(?=\()`],
    ["c-tag", String.raw`[.#][A-Za-z_][\w-]*|::?[A-Za-z-]+(?=[\s,{:)>+~]|$)`],
  ];
  RULES.html = [
    ["c-cm", String.raw`<!--[\s\S]*?-->`],
    ["c-attr", String.raw`<![A-Za-z][^>]*>`],
    ["c-str", String.raw`"[^"]*"|'[^']*'`],
    ["c-tag", String.raw`<\/?[A-Za-z][\w:-]*|\/?>`],
    ["c-attr", String.raw`[\w:@.-]+(?==)`],
    ["c-var", String.raw`&[#\w]+;`],
  ];

  const EXTENSIONS = {
    js: "js", mjs: "js", cjs: "js", jsx: "js", ts: "ts", tsx: "ts",
    py: "python", java: "java", go: "go", rs: "rust",
    c: "c", cpp: "c", h: "c", sh: "shell", zsh: "shell", sql: "sql", ini: "ini",
    css: "css", html: "html", htm: "html", xml: "html",
  };

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const compiled = new Map();

  function scanner(lang) {
    if (!compiled.has(lang)) {
      const rules = RULES[lang];
      const flags = lang === "sql" ? "gmi" : "gm";
      compiled.set(lang, { classes: rules.map(([name]) => name), re: new RegExp(rules.map(([, p]) => `(${p})`).join("|"), flags) });
    }
    return compiled.get(lang);
  }

  function tokens(lang, src) {
    const { classes, re } = scanner(lang);
    let out = "";
    let last = 0;
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(src))) {
      if (match[0] === "") {
        re.lastIndex++;
        continue;
      }
      const group = match.findIndex((value, index) => index > 0 && value !== undefined) - 1;
      out += esc(src.slice(last, match.index)) + `<span class="${classes[group]}">${esc(match[0])}</span>`;
      last = match.index + match[0].length;
    }
    return out + esc(src.slice(last));
  }

  // <style> and <script> bodies inside HTML use the CSS and JavaScript rules.
  function html(src) {
    const embedded = /(<(style|script)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi;
    let out = "";
    let last = 0;
    let match;
    while ((match = embedded.exec(src))) {
      const [, open, tag, body, close] = match;
      out += tokens("html", src.slice(last, match.index)) + tokens("html", open) + tokens(tag.toLowerCase() === "style" ? "css" : "js", body) + tokens("html", close);
      last = match.index + match[0].length;
    }
    return out + tokens("html", src.slice(last));
  }

  function highlight(ext, src) {
    const lang = EXTENSIONS[String(ext).toLowerCase()];
    if (!lang) return esc(src);
    return lang === "html" ? html(src) : tokens(lang, src);
  }

  globalThis.codeHighlight = { highlight, EXTENSIONS };
})();
