import type { Section } from "@/lib/features/types";
import { CtaButtons } from "./CtaButtons";
import { FeatureVisual } from "./FeatureVisual";

// Maps each modular `Section` to its native, on-brand block. The article
// template (`FeatureArticle.tsx`) walks the section list and calls this for
// each one, themed by the page's accent colour via the `--ac` CSS variable.

export function SectionRenderer({ section }: { section: Section }) {
  switch (section.kind) {
    case "hero":
      return (
        <header className="ft-hero" id={section.id}>
          {section.kicker && <span className="ft-kicker">{section.kicker}</span>}
          <h1 className="ft-hero-title">{section.title}</h1>
          {section.subtitle && <p className="ft-hero-sub">{section.subtitle}</p>}
          {section.badges && (
            <div className="hero-badges">
              {section.badges.map((b) => (
                <span key={b} className="hero-badge" style={varAccent("inherit")}>
                  {b}
                </span>
              ))}
            </div>
          )}
          {section.cta && <CtaButtons links={section.cta} />}
        </header>
      );

    case "prose":
      // The hero is always the page's single <h1>; prose headings are <h2>.
      // `lede` only widens the copy for the opening paragraph block.
      return (
        <section
          className={`ft-prose${section.lede ? " ft-prose--lede" : ""}`}
          id={section.id}
          aria-labelledby={headingId(section.id)}
        >
          {section.heading && (
            <h2 id={headingId(section.id)} className="ft-h2">
              {section.heading}
            </h2>
          )}
          {section.body.map((p, i) => (
            <p key={i} className="ft-p">
              {p}
            </p>
          ))}
        </section>
      );

    case "split":
      return (
        <section
          className={`ft-split${section.media === "left" ? " ft-split--rev" : ""}`}
          id={section.id}
          aria-labelledby={headingId(section.id)}
        >
          <div className="ft-split-copy">
            <h2 id={headingId(section.id)} className="ft-h2">
              {section.heading}
            </h2>
            {section.body.map((p, i) => (
              <p key={i} className="ft-p">
                {p}
              </p>
            ))}
            {section.bullets && (
              <ul className="ft-bullets">
                {section.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {section.cta && <CtaButtons links={section.cta} />}
          </div>
          <div className="ft-split-media">
            {section.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={section.image.src}
                alt={section.image.alt}
                width={section.image.width}
                height={section.image.height}
                loading="lazy"
                className="ft-img"
              />
            ) : section.visual ? (
              <FeatureVisual name={section.visual} />
            ) : null}
          </div>
        </section>
      );

    case "grid":
      return (
        <section className="ft-block" id={section.id} aria-labelledby={headingId(section.id)}>
          {section.heading && (
            <h2 id={headingId(section.id)} className="ft-h2">
              {section.heading}
            </h2>
          )}
          {section.intro && <p className="ft-intro">{section.intro}</p>}
          <div className="ft-grid">
            {section.items.map((it) => (
              <article key={it.title} className="ft-grid-card" style={varAccent(it.color)}>
                {it.badge && <span className="ft-grid-badge">{it.badge}</span>}
                <h3 className="ft-grid-title">{it.title}</h3>
                <p className="ft-grid-body">{it.body}</p>
              </article>
            ))}
          </div>
        </section>
      );

    case "steps":
      return (
        <section className="ft-block" id={section.id} aria-labelledby={headingId(section.id)}>
          {section.heading && (
            <h2 id={headingId(section.id)} className="ft-h2">
              {section.heading}
            </h2>
          )}
          {section.intro && <p className="ft-intro">{section.intro}</p>}
          <ol className="ft-steps">
            {section.steps.map((s, i) => (
              <li key={s.title} className="ft-step" style={varAccent(s.color)}>
                <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="ft-step-title">{s.title}</h3>
                  <p className="ft-step-body">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      );

    case "code":
      return (
        <section className="ft-block" id={section.id} aria-labelledby={headingId(section.id)}>
          {section.heading && (
            <h2 id={headingId(section.id)} className="ft-h2">
              {section.heading}
            </h2>
          )}
          <pre className="code-card ft-code">
            <code>
              {section.lines.map((line, li) => (
                <span key={li} className="ft-code-line">
                  {line.map((tok, ti) => (
                    <span key={ti} className={tok.cls}>
                      {tok.t}
                    </span>
                  ))}
                  {"\n"}
                </span>
              ))}
            </code>
          </pre>
          {section.caption && <p className="ft-caption">{section.caption}</p>}
        </section>
      );

    case "faq":
      return (
        <section className="ft-block" id={section.id ?? "faq"} aria-labelledby={headingId(section.id ?? "faq")}>
          <h2 id={headingId(section.id ?? "faq")} className="ft-h2">
            {section.heading ?? "Frequently asked questions"}
          </h2>
          <div className="ft-faq">
            {section.items.map((it) => (
              <details key={it.q} className="ft-faq-item">
                <summary>{it.q}</summary>
                <p>{it.a}</p>
              </details>
            ))}
          </div>
        </section>
      );

    case "callout":
      return (
        <aside className="ft-callout" id={section.id} style={varAccent(section.color)}>
          <h2 className="ft-callout-title">{section.title}</h2>
          <p className="ft-callout-body">{section.body}</p>
        </aside>
      );

    case "cta":
      return (
        <section className="ft-banner accent-card" id={section.id} style={varAccent(section.color)}>
          <h2 className="ft-banner-title">{section.heading}</h2>
          {section.body && <p className="ft-banner-body">{section.body}</p>}
          <CtaButtons links={section.links} />
        </section>
      );
  }
}

/** Sets the `--ac` accent CSS variable; "inherit" keeps the page accent. */
function varAccent(color?: string): React.CSSProperties {
  if (!color || color === "inherit") return {};
  return { ["--ac" as string]: color } as React.CSSProperties;
}

/** Derives a stable heading id for aria-labelledby from a section id. */
function headingId(id?: string): string | undefined {
  return id ? `${id}-h` : undefined;
}
