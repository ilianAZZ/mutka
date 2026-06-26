import type { Metadata } from "next";
import Link from "next/link";
import { FEATURE_ARTICLES } from "@/lib/features/articles";
import { FeatureCardGrid } from "@/components/features/FeatureCardGrid";
import { SITE_URL } from "@/lib/site";

// The features hub: a single, crawlable index linking every feature article.
// Each card carries the article's accent, glyph and one-line hook.

const TITLE = "Features — what makes Mutka different";
const DESCRIPTION =
  "Explore Mutka's key ideas: a modular architecture where every feature is a module, a permission sandbox that keeps you safe, a live extension manager, and modules built by AI.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/features" },
  openGraph: {
    type: "website",
    url: "/features",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/features#page`,
      url: `${SITE_URL}/features`,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: "en-US",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#app` },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${SITE_URL}/features#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Features", item: `${SITE_URL}/features` },
      ],
    },
    {
      "@type": "ItemList",
      "@id": `${SITE_URL}/features#list`,
      itemListElement: FEATURE_ARTICLES.map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: a.title,
        url: `${SITE_URL}/features/${a.slug}`,
      })),
    },
  ],
};

export default function FeaturesHub() {
  return (
    <main className="ft-hub">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="ft-crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Features</span>
      </nav>

      <header className="ft-hub-head">
        <span className="ft-kicker">the ideas behind mutka</span>
        <h1 className="ft-hero-title">
          What makes Mutka{" "}
          <span className="ft-hub-grad">different</span>
        </h1>
        <p className="ft-hero-sub">
          Mutka keeps a tiny core and ships everything else as modules. Here&apos;s a
          closer look at the ideas that follow from that — each one its own deep dive.
        </p>
        <div className="ft-hub-meta">
          <span>{FEATURE_ARTICLES.length} articles</span>
          <span aria-hidden="true">·</span>
          <span>~4&nbsp;min reads</span>
          <span aria-hidden="true">·</span>
          <span>Updated June 2026</span>
        </div>
      </header>

      <FeatureCardGrid lead />
    </main>
  );
}
