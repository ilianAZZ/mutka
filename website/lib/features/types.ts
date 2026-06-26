// The shape of a feature article and the modular sections it is built from.
// A feature page is pure data: an ordered list of `Section`s that the template
// (`components/features/FeatureArticle.tsx`) renders into native, on-brand
// blocks. Adding a new block type means adding a variant here and a renderer in
// `components/features/sections/` — nothing else changes.

/** A single call-to-action link (button). */
export interface CtaLink {
  label: string;
  href: string;
  /** `primary` is the filled accent button; `ghost` is bordered; `dark` is the GitHub-style button. */
  variant?: "primary" | "ghost" | "dark";
  external?: boolean;
}

/** One coloured token on a syntax-highlighted code line. */
export interface CodeToken {
  t: string;
  /** A `tok-*` class from global.css (e.g. `tok-key`, `tok-fn`, `tok-str`). */
  cls?: string;
}

/** A keyed, on-brand CSS illustration rendered by `FeatureVisual`. */
export type VisualName =
  | "gateway" // permission gateway barrier
  | "permissions" // a manifest's allow/deny permission list
  | "modules" // a grid of pluggable module tiles
  | "window" // a mock Mutka window (file listing)
  | "manager" // the Modules overlay / install review
  | "ai"; // an AI prompt → generated module

/** A real raster/vector asset (screenshot, diagram) for a split block. */
export interface ImageAsset {
  src: string;
  alt: string;
  width: number;
  height: number;
}

// ---- Section variants -------------------------------------------------------

interface SectionBase {
  /** Optional anchor id so a section can be deep-linked and listed in the ToC. */
  id?: string;
}

/** The page header: kicker, big title, lede and optional pill badges. */
export interface HeroSection extends SectionBase {
  kind: "hero";
  kicker?: string;
  title: string;
  subtitle?: string;
  badges?: string[];
  cta?: CtaLink[];
}

/** A plain prose block: an optional heading and one or more paragraphs. */
export interface ProseSection extends SectionBase {
  kind: "prose";
  heading?: string;
  /** Each string is rendered as its own paragraph; inline HTML is not parsed. */
  body: string[];
  /** Render the heading as the page's single `h1` (used by lede sections). */
  lede?: boolean;
}

/** A two-column block pairing copy with an image or a keyed illustration. */
export interface SplitSection extends SectionBase {
  kind: "split";
  heading: string;
  body: string[];
  /** Side the visual sits on (desktop only). Defaults to `right`. */
  media?: "left" | "right";
  bullets?: string[];
  image?: ImageAsset;
  visual?: VisualName;
  cta?: CtaLink[];
}

/** A responsive grid of small accented cards. */
export interface GridSection extends SectionBase {
  kind: "grid";
  heading?: string;
  intro?: string;
  items: { title: string; body: string; badge?: string; color?: string }[];
}

/** A vertical list of numbered steps. */
export interface StepsSection extends SectionBase {
  kind: "steps";
  heading?: string;
  intro?: string;
  steps: { title: string; body: string; color?: string }[];
}

/** A syntax-highlighted code card with an optional caption. */
export interface CodeSection extends SectionBase {
  kind: "code";
  heading?: string;
  caption?: string;
  /** Each inner array is one line, made of coloured tokens. */
  lines: CodeToken[][];
}

/** A frequently-asked-questions accordion. Also feeds `FAQPage` JSON-LD. */
export interface FaqSection extends SectionBase {
  kind: "faq";
  heading?: string;
  items: { q: string; a: string }[];
}

/** A highlighted aside (tip / note) drawing the eye with an accent border. */
export interface CalloutSection extends SectionBase {
  kind: "callout";
  title: string;
  body: string;
  color?: string;
}

/** A closing call-to-action banner. */
export interface CtaSection extends SectionBase {
  kind: "cta";
  heading: string;
  body?: string;
  links: CtaLink[];
  color?: string;
}

export type Section =
  | HeroSection
  | ProseSection
  | SplitSection
  | GridSection
  | StepsSection
  | CodeSection
  | FaqSection
  | CalloutSection
  | CtaSection;

// ---- The article -----------------------------------------------------------

export interface FeatureArticle {
  /** URL slug under `/features/<slug>`. */
  slug: string;
  /** Short label for nav, cards and breadcrumbs. */
  label: string;
  /** `<title>` and `h1` of the page. */
  title: string;
  /** Meta description + card summary. Keep it ~150 chars. */
  description: string;
  /** One-line hook shown on the features hub card. */
  hook: string;
  /** A few short topic chips shown on the article card. */
  topics?: string[];
  /** Accent colour (hex) that themes the whole page. */
  accent: string;
  /** Short glyph/badge shown on the hub card. */
  badge: string;
  /** ISO date the article was first published (for `Article` JSON-LD). */
  datePublished: string;
  /** ISO date the article was last updated. */
  dateModified: string;
  /** The ordered blocks that make up the page. */
  sections: Section[];
  /** Slugs of related articles, shown at the foot of the page. */
  related?: string[];
}
