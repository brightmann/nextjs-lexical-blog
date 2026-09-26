import MiniSearch from "minisearch";
import searchIndexJson from "@/data/search-index.json";

// Tokenizer for CJK + Latin text.
//
// Uses Intl.Segmenter (available in Node.js and in Cloudflare Workers) instead
// of the native @node-rs/jieba module, which ships .node binaries and cannot
// run on Workers. CJK character bigrams are emitted as well so partial-word
// CJK queries keep matching, mimicking jieba's search mode.
//
// Keep in sync with the indexer in scripts/build-search-index.mjs (used for
// queries here, for indexing there).
const NonCJKLRecognizeRegex =
  /[^\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u31c0-\u31ef\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u0041-\u005a\u0061-\u007a\u00c0-\u00ff\u0100-\u017f\u0180-\u024f\s ]/g;
const CJK_CHAR_REGEX =
  /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af\u3400-\u4dbf\uf900-\ufaff]/;
const segmenter = new Intl.Segmenter(["zh", "en"], { granularity: "word" });

export function tokenizeForSearch(input: string): string[] {
  const cleaned = input.replace(NonCJKLRecognizeRegex, " ");
  const tokens: string[] = [];
  for (const { segment, isWordLike } of segmenter.segment(cleaned)) {
    if (!isWordLike) continue;
    const token = segment.trim();
    if (token === "") continue;
    tokens.push(token);
    if (token.length > 1 && CJK_CHAR_REGEX.test(token)) {
      for (let i = 0; i < token.length - 1; i++) {
        tokens.push(token.slice(i, i + 2));
      }
    }
  }
  return tokens;
}

// The index is prebuilt at build time (scripts/build-search-index.mjs, run via
// the `prebuild` npm script) and bundled as JSON, because Cloudflare Workers
// have no filesystem access to read the markdown posts at request time.
export const SearchIndex = MiniSearch.loadJSON(JSON.stringify(searchIndexJson), {
  fields: ["id", "title", "tags", "subtitle", "summary", "content"],
  storeFields: ["id", "title", "tags", "summary"],
  tokenize: tokenizeForSearch,
});
