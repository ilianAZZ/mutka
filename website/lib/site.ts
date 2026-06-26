// Single source of truth for the site's identity. Imported by metadata,
// robots, sitemap, JSON-LD and the llms.txt routes so the canonical domain and
// the marketing copy can never drift apart across files.

export const SITE_URL = "https://mutka.app";
export const SITE_NAME = "Mutka";
export const SITE_TAGLINE = "A modular, community-driven file explorer for macOS";
export const TITLE = `Mutka — ${SITE_TAGLINE}`;

export const DESCRIPTION =
  "Mutka ships a minimal, rock-solid core and lets the community build everything else as modules — even copy-paste and navigation. Modules are a single file designed to be plugged in (and built by AI). Built with Tauri 2, React and the macOS Liquid Glass design language.";

/** Short, scannable description for cards/manifest where the long copy is too much. */
export const SHORT_DESCRIPTION =
  "A minimal, rock-solid core. Everything else is a community module — designed to be plugged in and built by AI.";

// Social cards are served by the file-convention routes (app/opengraph-image.tsx
// and app/twitter-image.tsx). We reference them as ABSOLUTE urls in metadata so
// preview scrapers that don't resolve relative og:image paths still find them.
export const OG_IMAGE = `${SITE_URL}/opengraph-image`;
export const TWITTER_IMAGE = `${SITE_URL}/twitter-image`;
export const OG_IMAGE_ALT =
  "Mutka — a modular, community-driven file explorer for macOS";
