import postsDataJson from "@/data/posts-data.json";
import type {
  TPostFrontmatter,
  TPostListItem,
  TPostsByTag,
  TPostTOCItem,
} from "@/types/docs.type";
import type { MDXRemoteSerializeResult } from "next-mdx-remote";

// Precomputed at build time by scripts/build-posts-data.mjs (Node.js), because
// getStaticProps can run at runtime on Cloudflare Workers where `fs` and
// `eval` (used by MDX serialize) are unavailable.
type TPrecomputedPost = {
  frontmatter: TPostFrontmatter;
  content: string;
  compiledSource: MDXRemoteSerializeResult;
  tocList: TPostTOCItem[];
};

const postsData = postsDataJson as Record<string, TPrecomputedPost>;

export const getPostFileContent = (postId: string): string | null => {
  return postsData[postId]?.content ?? null;
};

export const getPrecomputedPost = (postId: string): TPrecomputedPost | null => {
  return postsData[postId] ?? null;
};

const sortOutPosts = (): {
  allPostList: TPostListItem[];
  pinnedPostList: TPostListItem[];
  postsByTag: TPostsByTag;
} => {
  const allPostList: TPostListItem[] = [];
  const pinnedPostList: TPostListItem[] = [];
  const postsByTag: TPostsByTag = {};

  for (const postId of Object.keys(postsData)) {
    const currentPostListItem: TPostListItem = {
      id: postId,
      frontMatter: postsData[postId].frontmatter,
    };

    if (!currentPostListItem.frontMatter.closed) {
      allPostList.push(currentPostListItem);
      if (currentPostListItem.frontMatter.pin) {
        pinnedPostList.push(currentPostListItem);
      }
    }
  }

  pinnedPostList.sort((a, b) => {
    return a.frontMatter.time > b.frontMatter.time ? -1 : 1;
  });

  allPostList.sort((a, b) => {
    return a.frontMatter.time > b.frontMatter.time ? -1 : 1;
  });

  allPostList.forEach((item) => {
    item.frontMatter.tags?.forEach((tagName: string) => {
      if (postsByTag[tagName] == null) {
        postsByTag[tagName] = [];
      }
      postsByTag[tagName].push(item);
    });
  });

  return { allPostList: allPostList, postsByTag: postsByTag, pinnedPostList: pinnedPostList };
};

export const sortedPosts = sortOutPosts();
