// Prebuild script: precomputes post data for Cloudflare Workers.
// getStaticProps runs at runtime on Workers (minimal mode skips the incremental
// cache), where `fs` and `eval` (used by MDX serialize) are unavailable.
// So we precompute everything at build time (Node.js) into data/posts-data.json:
//   - normalized frontmatter per post
//   - raw markdown content per post
//   - serialized MDX (compiledSource) per post, using the same plugins as pages/blog/[id].tsx
//   - table-of-contents per post
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import { MDXRemote } from "next-mdx-remote";
import { serialize } from "next-mdx-remote/serialize";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypePresetMinify from "rehype-preset-minify";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import externalLinks from "remark-external-links";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { titleCase } from "title-case";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, "..", "data", "posts");
const outFile = path.join(__dirname, "..", "data", "posts-data.json");

const isEmptyString = (s) => s == null || s === "";
const nullifyEmptyString = (s) => (isEmptyString(s) ? null : s);
const nullifyEmptyArray = (a) => (a == null || a.length === 0 ? null : a);

function makeTOCTree(htmlCode) {
  const dom = new JSDOM(htmlCode);
  const headers = dom.window.document.querySelectorAll("h1,h2,h3,h4,h5,h6");
  const result = [];
  for (const h of headers) {
    result.push({
      level: Number.parseInt(h.tagName.replace("H", "")),
      anchorId: h.id,
      title: h.textContent,
    });
  }
  return result;
}

const data = {};
const fileNames = fs.readdirSync(postsDir).filter((f) => f.endsWith(".md")).sort();

for (const fileName of fileNames) {
  const postId = fileName.slice(0, -3);
  const source = fs.readFileSync(path.join(postsDir, fileName), "utf-8");

  // 1. Frontmatter (same normalization as lib/post-process.ts)
  const fmSource = await serialize(source, {
    parseFrontmatter: true,
    mdxOptions: { format: "md" },
  });
  const fm = fmSource.frontmatter;
  const normalizedTags = fm.tags?.filter((t) => !isEmptyString(t)).map((t) => t.toUpperCase());
  const frontmatter = {
    title: titleCase(fm.title),
    subtitle: nullifyEmptyString(fm.subtitle),
    coverURL: nullifyEmptyString(fm.coverURL),
    tags: nullifyEmptyArray(normalizedTags),
    summary: nullifyEmptyString(fm.summary),
    time: fm.time,
    pin: fm.pin ?? false,
    noPrompt: fm.noPrompt ?? false,
    allowShare: fm.allowShare ?? true,
    closed: fm.closed ?? false,
  };

  // 2. Full serialized MDX (same plugins as pages/blog/[id].tsx)
  const mdxSource = await serialize(source, {
    parseFrontmatter: true,
    mdxOptions: {
      remarkPlugins: [externalLinks, remarkMath, remarkGfm],
      rehypePlugins: [
        rehypeRaw,
        rehypeKatex,
        rehypeAutolinkHeadings,
        rehypeSlug,
        rehypePresetMinify.plugins,
        () => rehypeHighlight({ detect: true }),
      ],
      format: "md",
    },
  });

  // 3. TOC from rendered HTML
  const html = renderToString(React.createElement(MDXRemote, mdxSource));
  const tocList = makeTOCTree(html);

  data[postId] = {
    frontmatter,
    content: source,
    compiledSource: mdxSource,
    tocList,
  };
  console.log(`  processed ${postId}`);
}

fs.writeFileSync(outFile, JSON.stringify(data));
console.log(`Wrote ${outFile} (${Object.keys(data).length} posts)`);
