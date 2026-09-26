import { DrawerTOC } from "@/components/reader-page/DrawerTOC";
import { MorePostLinks } from "@/components/reader-page/MorePostLinks";
import { PostComments } from "@/components/reader-page/PostComments";
import { PostCover } from "@/components/reader-page/PostCover";
import { PostRender } from "@/components/reader-page/PostRender";
import { ShareButtons } from "@/components/reader-page/ShareButtons";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/toaster";
import { Footer } from "@/components/utils/Footer";
import { ContentContainer, Page } from "@/components/utils/Layout";
import { NavBar } from "@/components/utils/NavBar";
import { SEO } from "@/components/utils/SEO";
import { Config } from "@/data/config";
import { getPrecomputedPost, sortedPosts } from "@/lib/post-process";
import type { TPostFrontmatter, TPostListItem, TPostTOCItem } from "@/types/docs.type";
import type { GetStaticPaths, GetStaticProps } from "next";
import { MDXRemote, type MDXRemoteSerializeResult } from "next-mdx-remote";
import { titleCase } from "title-case";

type ReaderPageProps = {
  compiledSource: MDXRemoteSerializeResult;
  tocList: TPostTOCItem[];
  frontMatter: TPostFrontmatter;
  postId: string;
  nextPostListItem: TPostListItem | null;
  prevPostListItem: TPostListItem | null;
};

const ReaderPage = (props: ReaderPageProps) => {
  // Only the TOC length reaches 3 can be displayed.
  // In order to avoid large blank spaces that ruin the visual perception
  const isTOCLongEnough = props.tocList.length > 2;
  // const handleLeftSwipe = useSwipeable({
  //   onSwipedLeft: () => isTOCLongEnough && setIsTOCOpen(true),
  //   delta: 150,
  // });

  return (
    <Page>
      <SEO
        coverURL={props.frontMatter.coverURL}
        description={props.frontMatter.summary}
        title={`${titleCase(props.frontMatter.title)} - ${Config.SiteTitle}`}
      />
      <Toaster />
      <NavBar />
      <ContentContainer>
        <div className="mx-auto flex flex-col justify-center py-5" style={{ width: "min(50rem,100%)" }}>
          {props.frontMatter.coverURL && <PostCover coverURL={props.frontMatter.coverURL} />}
          <PostRender
            compiledSource={props.compiledSource}
            tocList={props.tocList}
            frontMatter={props.frontMatter}
            postId={props.postId}
            nextPostListItem={props.nextPostListItem}
            prevPostListItem={props.prevPostListItem}
          />
          <Separator />
          <ShareButtons
            allowShare={props.frontMatter.allowShare}
            postId={props.postId}
            quote={props.frontMatter.summary}
            subtitle={props.frontMatter.subtitle}
            title={props.frontMatter.title}
          />
          <Separator />
          <MorePostLinks prevPostListItem={props.prevPostListItem} nextPostListItem={props.nextPostListItem} />
          {Config.Giscus?.enabled && <PostComments postId={props.postId} />}
          {isTOCLongEnough && <DrawerTOC data={props.tocList} />}
        </div>
      </ContentContainer>
      <Footer />
    </Page>
  );
};

export const getStaticPaths: GetStaticPaths<{ id: string }> = async () => {
  const allPaths = sortedPosts.allPostList.map((item) => ({
    params: { id: item.id },
  }));
  return {
    paths: allPaths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<ReaderPageProps> = async (context) => {
  const postId = context.params?.id;

  if (postId == null || Array.isArray(postId)) {
    return { notFound: true };
  }

  // Precomputed at build time (scripts/build-posts-data.mjs): MDX serialize uses
  // eval, which is unavailable on Cloudflare Workers.
  const precomputed = getPrecomputedPost(postId);

  if (precomputed == null) {
    return { notFound: true };
  }

  const mdxSource = precomputed.compiledSource;
  const tocList = precomputed.tocList;

  const postIndexInAllPosts = sortedPosts.allPostList.findIndex((item) => item.id === postId);

  const frontMatter: TPostFrontmatter = sortedPosts.allPostList[postIndexInAllPosts].frontMatter;

  const nextPostListItem =
    postIndexInAllPosts !== sortedPosts.allPostList.length - 1
      ? sortedPosts.allPostList[postIndexInAllPosts + 1]
      : null;

  const prevPostListItem = postIndexInAllPosts !== 0 ? sortedPosts.allPostList[postIndexInAllPosts - 1] : null;

  return {
    props: {
      compiledSource: mdxSource,
      tocList: tocList,
      frontMatter: frontMatter,
      postId: postId,
      nextPostListItem: nextPostListItem,
      prevPostListItem: prevPostListItem,
    },
  };
};

export default ReaderPage;
