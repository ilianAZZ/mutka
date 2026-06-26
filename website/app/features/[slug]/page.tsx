import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FEATURE_ARTICLES, getArticle } from "@/lib/features/articles";
import { FeatureArticle } from "@/components/features/FeatureArticle";

// One feature article per slug, rendered from data through the modular
// template. Statically generated for every article in the registry.

export function generateStaticParams() {
  return FEATURE_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const article = getArticle(slug);
  if (!article) return {};

  const url = `/features/${article.slug}`;
  return {
    title: article.title,
    description: article.description,
    keywords: [
      "mutka",
      "macos file explorer",
      article.label.toLowerCase(),
      "modular",
      "module system",
    ],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: article.title,
      description: article.description,
      publishedTime: article.datePublished,
      modifiedTime: article.dateModified,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
    },
  };
}

export default async function FeaturePage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const article = getArticle(slug);
  if (!article) notFound();

  return <FeatureArticle article={article} />;
}
