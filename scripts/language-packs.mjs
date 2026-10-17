#!/usr/bin/env node
// (Re)generate the language packs, extensions/typora.lang-*:
//
//   node scripts/language-packs.mjs --i18n <dir> --dictionaries <dir>
//
// --i18n          folders `<locale>.lproj/{Front,Menu,Panel}.json`
//                 (the Typora 1 catalogs, TypeMark/locales)
// --dictionaries  folders `<language>/{index.aff,index.dic,LICENSE}`
//                 (github.com/typora/dict.typora.io, dictionaries/)
//
// A pack's existing translations/<locale>.json wins: the catalogs only add
// strings it does not have yet, so strings translated here (for Typora 2)
// are kept. Bump `version` by hand after changing a pack. A string the app
// shows but a catalog lacks stays English: add it to the pack's catalog.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSIONS_DIR, MANIFEST } from "./lib.mjs";

const args = process.argv.slice(2);
const arg = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const I18N = arg("--i18n");
const DICTIONARIES = arg("--dictionaries");
if (!I18N || !DICTIONARIES) {
  console.error("usage: node scripts/language-packs.mjs --i18n <dir> --dictionaries <dir>");
  process.exit(2);
}

/**
 * locale, name in the language, English name, Typora 1 catalog folder,
 * dictionaries: [language tag, folder under --dictionaries].
 * Keep in step with KNOWN_LANGUAGE_PACKS (packages/workbench/src/extensions/languagePacks.ts).
 */
const PACKS = [
  ["ar", "العربية", "Arabic", "ar-SA", [["ar", "ar"]]],
  ["ca", "Català", "Catalan", "ca-ES", [["ca", "ca"]]],
  ["cs", "Čeština", "Czech", "cs-CZ", [["cs", "cs"]]],
  ["da", "Dansk", "Danish", "da-DK", [["da", "da"]]],
  ["de", "Deutsch", "German", "de-DE", [["de", "de"]]],
  ["de-CH", "Deutsch (Schweiz)", "German (Switzerland)", "de-CH", [["de-CH", "de-CH"]]],
  ["el", "Ελληνικά", "Greek", "el-GR", [["el", "el"]]],
  ["es", "Español", "Spanish", "es-ES", [["es", "es"]]],
  ["fa", "فارسی", "Persian", "fa-IR", [["fa", "fa"]]],
  ["fr", "Français", "French", "fr-FR", [["fr", "fr"]]],
  ["ga", "Gaeilge", "Irish", "ga-IE", [["ga", "ga"]]],
  ["gl", "Galego", "Galician", "gl-ES", [["gl", "gl"]]],
  ["he", "עברית", "Hebrew", "he-IL", [["he", "he"]]],
  ["hi", "हिन्दी", "Hindi", "hi-IN", [["hi", "hi"]]],
  ["hr", "Hrvatski", "Croatian", "hr-HR", [["hr", "hr"]]],
  ["hu", "Magyar", "Hungarian", "hu-HU", [["hu", "hu"]]],
  ["id", "Bahasa Indonesia", "Indonesian", "id-ID", [["id", "id"]]],
  ["it", "Italiano", "Italian", "it-IT", [["it", "it"]]],
  ["ja", "日本語", "Japanese", "ja-JP", []],
  ["ko", "한국어", "Korean", "ko-KR", [["ko", "ko"]]],
  ["ms", "Bahasa Melayu", "Malay", "ms-MY", [["ms", "ms"]]],
  ["nb", "Norsk bokmål", "Norwegian Bokmål", "nb-NO", [["nb", "nb"]]],
  ["nl", "Nederlands", "Dutch", "nl-NL", [["nl", "nl"]]],
  ["nn", "Norsk nynorsk", "Norwegian Nynorsk", "nn-NO", [["nn", "nn"]]],
  ["pl", "Polski", "Polish", "pl-PL", [["pl", "pl"]]],
  ["pt-BR", "Português (Brasil)", "Portuguese (Brazil)", "pt-BR", [["pt-BR", "pt-BR"]]],
  ["pt-PT", "Português (Portugal)", "Portuguese (Portugal)", "pt-PT", [["pt-PT", "pt"]]],
  ["ro", "Română", "Romanian", "ro-RO", [["ro", "ro"]]],
  ["ru", "Русский", "Russian", "ru-RU", [["ru", "ru"]]],
  ["sk", "Slovenčina", "Slovak", "sk-SK", [["sk", "sk"]]],
  ["sl", "Slovenščina", "Slovenian", "sl-SI", [["sl", "sl"]]],
  ["sv", "Svenska", "Swedish", "sv-SE", [["sv", "sv"]]],
  ["th", "ไทย", "Thai", "th-TH", [["th", "th"]]],
  ["tr", "Türkçe", "Turkish", "tr-TR", [["tr", "tr"]]],
  ["uk", "Українська", "Ukrainian", "uk-UA", [["uk", "uk"]]],
  ["vi", "Tiếng Việt", "Vietnamese", "vi-VN", [["vi", "vi"]]],
];

/** English is built in; its pack only brings dictionaries (Linux has no system spellchecker). */
const ENGLISH = { id: "typora.lang-en", dictionaries: [["en-US", "en-US"], ["en-GB", "en-GB"]] };

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

function copyDictionaries(dir, dictionaries) {
  return dictionaries.map(([language, folder]) => {
    const source = join(DICTIONARIES, folder);
    const target = join(dir, "dictionaries", language);
    mkdirSync(target, { recursive: true });
    for (const file of ["index.aff", "index.dic", "LICENSE"]) {
      // A few dictionaries name it license.txt.
      const from = [file, file === "LICENSE" ? "license.txt" : null].filter(Boolean).find((f) => existsSync(join(source, f)));
      if (!from) throw new Error(`${source}/${file} is missing.`);
      copyFileSync(join(source, from), join(target, file));
    }
    return { language, aff: `dictionaries/${language}/index.aff`, dic: `dictionaries/${language}/index.dic` };
  });
}

function existingVersion(dir) {
  try {
    return readJson(join(dir, MANIFEST)).version;
  } catch {
    return "1.0.0";
  }
}

for (const [locale, name, englishName, lproj, dictionaryList] of PACKS) {
  const id = `typora.lang-${locale.toLowerCase()}`;
  const dir = join(EXTENSIONS_DIR, id);
  mkdirSync(join(dir, "translations"), { recursive: true });

  const catalogPath = join(dir, "translations", `${locale}.json`);
  const catalog = existsSync(catalogPath) ? readJson(catalogPath) : {};
  let added = 0;
  for (const part of ["Front", "Menu", "Panel"]) {
    const path = join(I18N, `${lproj}.lproj`, `${part}.json`);
    if (!existsSync(path)) continue;
    for (const [source, translation] of Object.entries(readJson(path))) {
      if (typeof translation !== "string" || !translation || translation === source || source in catalog) continue;
      catalog[source] = translation;
      added++;
    }
  }
  writeJson(catalogPath, catalog);

  const dictionaries = copyDictionaries(dir, dictionaryList);
  const description = dictionaries.length
    ? `Shows Typora in ${englishName}, and checks ${englishName} spelling when the system spellchecker has no ${englishName} dictionary.`
    : `Shows Typora in ${englishName}.`;
  writeJson(join(dir, MANIFEST), {
    id,
    name: `${name} Language Pack`,
    version: existingVersion(dir),
    description,
    author: "Typora Team",
    keywords: ["language pack", "translation", englishName, name, locale, ...(dictionaries.length ? ["spelling", "dictionary"] : [])],
    tags: ["Language Pack"],
    contributes: {
      localizations: [{ locale, name, englishName, path: `translations/${locale}.json` }],
      ...(dictionaries.length ? { dictionaries } : {}),
    },
  });
  writeFileSync(
    join(dir, "README.md"),
    `# ${name} Language Pack\n\n${description}\n\n` +
      `Choose **${name}** in Settings ▸ General ▸ Display Language.` +
      (dictionaries.length ? ` Pick **${dictionaries.map((d) => d.language).join("**, **")}** in Settings ▸ Editor ▸ Spelling Language if your system has no ${englishName} spelling dictionary.` : "") +
      `\n\nTranslations come from the community translators of [typora/Typora-i18n](https://github.com/typora/Typora-i18n); strings new in Typora 2 were added by Typora and await review by native speakers — corrections are welcome.` +
      (dictionaries.length ? " The Hunspell dictionaries come from [typora/dict.typora.io](https://github.com/typora/dict.typora.io); each folder under `dictionaries/` has its LICENSE." : "") +
      "\n",
  );
  console.log(`✓ ${id}: ${Object.keys(catalog).length} strings (+${added}), ${dictionaries.length} dictionar${dictionaries.length === 1 ? "y" : "ies"}`);
}

{
  const dir = join(EXTENSIONS_DIR, ENGLISH.id);
  mkdirSync(dir, { recursive: true });
  const dictionaries = copyDictionaries(dir, ENGLISH.dictionaries);
  const description = "Checks English (US and UK) spelling when the system has no spellchecker or no English dictionary, as on Linux.";
  writeJson(join(dir, MANIFEST), {
    id: ENGLISH.id,
    name: "English Spelling Dictionaries",
    version: existingVersion(dir),
    description,
    author: "Typora Team",
    keywords: ["language pack", "spelling", "dictionary", "English", "en"],
    tags: ["Language Pack"],
    contributes: { dictionaries },
  });
  writeFileSync(
    join(dir, "README.md"),
    `# English Spelling Dictionaries\n\n${description}\n\nPick **en-US** or **en-GB** in Settings ▸ Editor ▸ Spelling Language. ` +
      "The Hunspell dictionaries come from [typora/dict.typora.io](https://github.com/typora/dict.typora.io); each folder under `dictionaries/` has its LICENSE.\n",
  );
  console.log(`✓ ${ENGLISH.id}: ${dictionaries.length} dictionaries`);
}
