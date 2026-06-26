import Link from "next/link";
import { FEATURE_ARTICLES } from "@/lib/features/articles";
import type { FeatureArticle } from "@/lib/features/types";

// A polished, reusable grid of feature-article cards. Shared by the homepage
// showcase and the /features hub so they can never drift. The first article is
// rendered as a wider "featured" card; the rest fill an even grid.

function Card({ a, featured }: { a: FeatureArticle; featured?: boolean }) {
  return (
    <Link
      href={`/features/${a.slug}`}
      className={`feat-card accent-card${featured ? " feat-card--lead" : ""}`}
      style={{ ["--ac" as string]: a.accent }}
    >
      <span className="feat-badge">{a.badge}</span>
      <div className="feat-card-main">
        <span className="feat-label">{a.label}</span>
        <h3 className="feat-title">{featured ? a.title : a.hook}</h3>
        {featured && <p className="feat-hook">{a.hook}</p>}
        {a.topics && (
          <ul className="feat-topics">
            {a.topics.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
      </div>
      <span className="feat-go">Read article →</span>
    </Link>
  );
}

/**
 * @param lead  Render the first article as a wide featured card (hub layout).
 */
export function FeatureCardGrid({ lead = false }: { lead?: boolean }) {
  const [first, ...rest] = FEATURE_ARTICLES;
  if (!lead) {
    return (
      <div className="feat-grid">
        {FEATURE_ARTICLES.map((a) => (
          <Card key={a.slug} a={a} />
        ))}
      </div>
    );
  }
  return (
    <div className="feat-grid feat-grid--lead">
      <Card a={first} featured />
      {rest.map((a) => (
        <Card key={a.slug} a={a} />
      ))}
    </div>
  );
}
