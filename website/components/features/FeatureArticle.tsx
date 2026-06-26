import Link from "next/link";
import type { FeatureArticle as Article, FaqSection } from "@/lib/features/types";
import { SITE_URL } from "@/lib/site";
import { GITHUB_URL } from "@/app/layout.config";
import { getArticle } from "@/lib/features/articles";
import { SectionRenderer } from "./SectionRenderer";

// The feature-article template. Renders an `Article`'s modular sections into
// native blocks, themes the page with the article accent, and emits per-page
// structured data (TechArticle + BreadcrumbList + FAQPage) for SEO.

function buildJsonLd(article: Article) {
  const url = `${SITE_URL}/features/${article.slug}`;
  const faqItems = article.sections
    .filter((s): s is FaqSection => s.kind === "faq")
    .flatMap((s) => s.items);

  const graph: Record<string, unknown>[] = [
    {
      "@type": "TechArticle",
      "@id": `${url}#article`,
      headline: article.title,
      name: article.title,
      description: article.description,
      url,
      inLanguage: "en-US",
      datePublished: article.datePublished,
      dateModified: article.dateModified,
      image: `${SITE_URL}/opengraph-image`,
      author: { "@id": `${SITE_URL}/#org` },
      publisher: { "@id": `${SITE_URL}/#org` },
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#app` },
      mainEntityOfPage: url,
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Features", item: `${SITE_URL}/features` },
        { "@type": "ListItem", position: 3, name: article.label, item: url },
      ],
    },
  ];

  if (faqItems.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: faqItems.map((it) => ({
        "@type": "Question",
        name: it.q,
        acceptedAnswer: { "@type": "Answer", text: it.a },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export function FeatureArticle({ article }: { article: Article }) {
  const jsonLd = buildJsonLd(article);
  const related = (article.related ?? [])
    .map(getArticle)
    .filter((a): a is Article => Boolean(a));

  return (
    <main
      className="ft-article"
      style={{
        ["--ac" as string]: article.accent,
        ["--mutka-accent" as string]: article.accent,
      }}
    >
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb trail — visible, and mirrored by BreadcrumbList JSON-LD */}
      <nav className="ft-crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/features">Features</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{article.label}</span>
      </nav>

      <article className="ft-sections">
        {article.sections.map((section, i) => (
          <SectionRenderer key={section.id ?? `${section.kind}-${i}`} section={section} />
        ))}
      </article>

      {related.length > 0 && (
        <section className="ft-block ft-related" aria-labelledby="related-h">
          <h2 id="related-h" className="ft-h2">
            Keep exploring
          </h2>
          <div className="ft-grid">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/features/${r.slug}`}
                className="ft-grid-card ft-related-card"
                style={{ ["--ac" as string]: r.accent }}
              >
                <span className="ft-grid-badge">{r.badge}</span>
                <h3 className="ft-grid-title">{r.label}</h3>
                <p className="ft-grid-body">{r.hook}</p>
                <span className="ft-related-go">Read →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="ft-foot">
        <Link href="/features">← All features</Link>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          Star on GitHub
        </a>
      </footer>
    </main>
  );
}
