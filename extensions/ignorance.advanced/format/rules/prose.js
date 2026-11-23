import { spaceText } from "../cjk-spacing.js";

const HAN = /\p{Script=Han}/u;
const PUNCTUATION = { ",": "，", ".": "。", ";": "；", ":": "：", "!": "！", "?": "？", "(": "（", ")": "）" };
const FULL_WIDTH = /[ \t]*([，。；：！？（）])[ \t]*/g;
const INLINE = /(?<ticks>`+)(?!`)[\s\S]*?(?<!`)\k<ticks>(?!`)|\$\$[\s\S]*?\$\$|\$[^$\n]+\$|!?\[(?:\\.|[^\]\\\n])*\](?:\((?:\\.|[^()\\\n]|\((?:\\.|[^()\\\n])*\))*\)|\[[^\]\n]*\])|\[\[[^\]\n]+\]\]|\[\^[^\]\n]+\]|<!--[^]*?-->|<[^>\n]+>|(?:https?:\/\/|www\.)[^\s<>，。；：！？（）]+|\\[^\s]/gu;

function localizePunctuation(chunks, spans) {
  // Mask protected spans while keeping source offsets and sentence context.
  const masked = chunks.map((chunk, index) => chunk + "\0".repeat(spans[index]?.[0].length ?? 0)).join("");
  const chars = [...masked];
  const parentheses = [];
  let hanCount = 0;
  let sentenceHasHan = false;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const before = chars[i - 1] ?? "";
    const after = chars[i + 1] ?? "";
    if (HAN.test(char)) {
      hanCount++;
      sentenceHasHan = true;
      continue;
    }

    const adjacentHan = HAN.test(before) || HAN.test(after);
    if (char === "(") {
      parentheses.push({ index: i, hanCount, adjacentHan });
      if (adjacentHan) chars[i] = "（";
    } else if (char === ")") {
      const opening = parentheses.pop();
      if (adjacentHan || (opening && (opening.adjacentHan || opening.hanCount < hanCount))) {
        if (opening) chars[opening.index] = "（";
        chars[i] = "）";
      }
    } else if (/[.,;:!?]/.test(char)) {
      if (/[.,]/.test(char) && /\d/.test(before) && /\d/.test(after)) continue;
      let next = i + 1;
      if (/[,;:]/.test(char)) {
        while (chars[next] === " " || chars[next] === "\t") next++;
      }
      if (adjacentHan || sentenceHasHan || HAN.test(chars[next] ?? "")) chars[i] = PUNCTUATION[char];
    }

    if (/[.!?。！？]/.test(char)) sentenceHasHan = false;
  }

  let offset = 0;
  const localized = chars.join("");
  return chunks.map((chunk, index) => {
    const value = localized.slice(offset, offset + chunk.length);
    offset += chunk.length + (spans[index]?.[0].length ?? 0);
    return value.replace(FULL_WIDTH, "$1");
  });
}

export function formatProse(line, options) {
  const spans = [...line.matchAll(INLINE)];
  const chunks = [];
  let start = 0;
  for (const match of spans) {
    chunks.push(line.slice(start, match.index));
    start = match.index + match[0].length;
  }
  chunks.push(line.slice(start));

  const prose = options.lintPunctuation === false ? chunks : localizePunctuation(chunks, spans);
  return prose.map((chunk, index) => {
    if (options.lintEmphasis !== false) {
      chunk = chunk.replace(/(?<![\p{L}\p{N}_])_([^_\s](?:[^_]*?[^_\s])?)_(?![\p{L}\p{N}_])/gu, "*$1*");
    }
    if (options.lintCjkSpacing !== false) chunk = spaceText(chunk);
    return chunk + (spans[index]?.[0] ?? "");
  }).join("");
}
