// Builds data/search-index.json from the markdown posts.
//
// The search API route (pages/api/search/[keyword].ts) loads this prebuilt
// index instead of reading post files at request time. That is required on
// Cloudflare Workers, which have no filesystem access and cannot load native
// modules (the previous tokenizer, @node-rs/jieba, shipped .node binaries).
//
// Run automatically via the `prebuild` npm script before `next build`.
// The generated JSON is committed to the repo so `next dev` works too.
//
// NOTE: the tokenizer below must stay in sync with `tokenizeForSearch`
// in lib/search.ts (it is used for queries at runtime, this one for indexing).

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, parse } from "node:path";
import { fileURLToPath } from "node:url";
import MiniSearch from "minisearch";
import { titleCase } from "title-case";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = join(root, "data", "posts");
const outFile = join(root, "data", "search-index.json");

const INDEX_FIELDS = ["id", "title", "tags", "subtitle", "summary", "content"];
const STORE_FIELDS = ["id", "title", "tags", "summary"];

// ---------------------------------------------------------------------------
// Tokenizer (keep in sync with lib/search.ts)
// ---------------------------------------------------------------------------
const NonCJKLRecognizeRegex =
  /[^\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u31c0-\u31ef\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u0041-\u005a\u0061-\u007a\u00c0-\u00ff\u0100-\u017f\u0180-\u024f\s ]/g;
const CJK_CHAR_REGEX = /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af\u3400-\u4dbf\uf900-\ufaff]/;
const segmenter = new Intl.Segmenter(["zh", "en"], { granularity: "word" });

function tokenizeForSearch(input) {
  const cleaned = input.replace(NonCJKLRecognizeRegex, " ");
  const tokens = [];
  for (const { segment, isWordLike } of segmenter.segment(cleaned)) {
    if (!isWordLike) continue;
    const token = segment.trim();
    if (token === "") continue;
    tokens.push(token);
    // Also emit CJK character bigrams so partial-word CJK queries match,
    // mimicking jieba's search mode.
    if (token.length > 1 && CJK_CHAR_REGEX.test(token)) {
      for (let i = 0; i < token.length - 1; i++) {
        tokens.push(token.slice(i, i + 2));
      }
    }
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Minimal frontmatter parser (covers the `key: value` / `key: [a, b]` shapes
// used by the posts in data/posts).
// ---------------------------------------------------------------------------
function stripQuotes(s) {
  if (
    s.length >= 2 &&
    ((s[0] === '"' && s.at(-1) === '"') || (s[0] === "'" && s.at(-1) === "'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (!match) return fm;
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith("[")) {
      const inner = value.slice(1, value.lastIndexOf("]"));
      value = inner
        .split(",")
        .map((s) => stripQuotes(s.trim()))
        .filter(Boolean);
    } else {
      value = stripQuotes(value);
    }
    fm[key] = value;
  }
  return fm;
}

// ---------------------------------------------------------------------------
// Build the index
// ---------------------------------------------------------------------------
const docs = [];
for (const file of readdirSync(postsDir)) {
  if (!file.endsWith(".md")) continue;
  const id = parse(file).name;
  const raw = readFileSync(join(postsDir, file), "utf8");
  const fm = parseFrontmatter(raw);
  docs.push({
    id,
    // Same normalizations as lib/post-process.ts so indexed/displayed values
    // match the rest of the site.
    title: titleCase(fm.title ?? id),
    tags: Array.isArray(fm.tags)
      ? fm.tags.map((t) => t.toUpperCase())
      : [],
    subtitle: fm.subtitle ?? "",
    summary: fm.summary ?? "",
    // The old runtime index used the full file content (including the
    // frontmatter block); keep that behavior for identical search results.
    content: raw,
  });
}

const miniSearch = new MiniSearch({
  fields: INDEX_FIELDS,
  storeFields: STORE_FIELDS,
  tokenize: tokenizeForSearch,
});
for (const doc of docs) miniSearch.add(doc);

writeFileSync(outFile, JSON.stringify(miniSearch.toJSON()));
const kb = (Buffer.byteLength(JSON.stringify(miniSearch.toJSON())) / 1024).toFixed(1);
console.log(`Search index ready: ${docs.length} posts -> ${outFile} (${kb} KB)`);
