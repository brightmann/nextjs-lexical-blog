// Prebuild script: generates public/rss.xml at build time (Node.js).
// Previously done in getStaticProps, but MDX serialize uses eval which is
// unavailable on Cloudflare Workers.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import { Feed } from "feed";
import { MDXRemote } from "next-mdx-remote";
import { serialize } from "next-mdx-remote/serialize";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeMathJax from "rehype-mathjax/svg";
import rehypePresetMinify from "rehype-preset-minify";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import externalLinks from "remark-external-links";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkPrism from "remark-prism";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

// Import TS config/data via regex (handles quotes inside strings).
const configPath = path.join(rootDir, "data", "config.ts");
const configSrc = fs.readFileSync(configPath, "utf-8");
const getStr = (key) => {
  // Matches: Key: "value" or Key: 'value', handling escaped quotes
  const m = configSrc.match(new RegExp(`${key}:\\s*("((?:[^"\\\\]|\\\\.)*)"|'((?:[^'\\\\]|\\\\.)*)')`));
  return m ? (m[2] ?? m[3] ?? "") : "";
};

const postsData = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "posts-data.json"), "utf-8"));

// Sort posts by time desc, filter closed, mirroring lib/post-process.ts
const allPosts = Object.entries(postsData)
  .map(([id, p]) => ({ id, frontMatter: p.frontmatter }))
  .filter((p) => !p.frontMatter.closed)
  .sort((a, b) => (a.frontMatter.time > b.frontMatter.time ? -1 : 1));

const SiteTitle = getStr("SiteTitle");
const SiteDomain = getStr("SiteDomain");
const Sentence = getStr("Sentence");
const AuthorName = getStr("AuthorName");
const AuthorEmail = getStr("email");
const YearStart = getStr("YearStart");
const year = new Date().getFullYear();
const CopyrightAnnouncement = `COPYRIGHT © ${YearStart === String(year) ? year : `${YearStart}-${year}`} ${AuthorName} ALL RIGHTS RESERVED`;

const NoticeForRSSReaders = (postId) => `
---
**NOTE:** Different RSS reader may have deficient even no support for svg formulations rendering. 
If it happens, [please read the origin web page](https://${SiteDomain}/blog/${postId}) to have better experience
`;

function minifyHTMLCode(htmlString) {
  const dom = new JSDOM(htmlString);
  const document = dom.window.document;
  document.querySelectorAll("*").forEach((el) => el.removeAttribute("class"));
  document.querySelectorAll("script, style").forEach((el) => el.parentElement?.removeChild(el));
  return dom.serialize();
}

const feed = new Feed({
  title: SiteTitle,
  description: Sentence,
  id: SiteDomain,
  link: `https://${SiteDomain}`,
  copyright: CopyrightAnnouncement,
  generator: "Node.js Feed",
  author: { name: AuthorName, email: AuthorEmail, link: `https://${SiteDomain}/about` },
});

const LatestPostCountInHomePage = 5;
for (let i = 0; i < Math.min(LatestPostCountInHomePage, allPosts.length); i++) {
  const post = allPosts[i];
  const postFileContent = `${postsData[post.id].content}${NoticeForRSSReaders(post.id)}`;
  const dateNumber = post.frontMatter.time.split("-").map((n) => Number.parseInt(n));
  const mdxSource = await serialize(postFileContent ?? "", {
    parseFrontmatter: true,
    mdxOptions: {
      remarkPlugins: [remarkPrism, externalLinks, remarkMath, remarkGfm],
      rehypePlugins: [rehypeMathJax, rehypeAutolinkHeadings, rehypeSlug, rehypePresetMinify, rehypeRaw],
      format: "md",
    },
  });
  const htmlContent = minifyHTMLCode(renderToString(React.createElement(MDXRemote, mdxSource)));

  feed.addItem({
    title: post.frontMatter.title,
    id: post.id,
    link: `https://${SiteDomain}/blog/${post.id}`,
    description: post.frontMatter.summary ?? undefined,
    content: htmlContent,
    author: [{ name: AuthorName, email: AuthorEmail, link: `https://${SiteDomain}/about` }],
    category: post.frontMatter.tags?.map((t) => ({ name: t })),
    date: new Date(dateNumber[0], dateNumber[1] - 1, dateNumber[2]),
    image: post.frontMatter.coverURL ?? undefined,
  });
}

const outFile = path.join(rootDir, "public", "rss.xml");
fs.writeFileSync(outFile, feed.rss2(), "utf-8");
console.log(`Wrote ${outFile}`);
