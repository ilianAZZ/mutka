// =============================================================================
// IMAGE SRC — sanitize a module-provided image (card icon, author avatar) before
// it ever reaches an <img src>.
//
// A module declares its images as data it controls, so the value is untrusted.
// We only ever render images via <img src> (never innerHTML), and we additionally
// gate the URL scheme here so a crafted value can't become an injection vector:
// ONLY an http(s) URL or a data:image/... URI is allowed through — anything else
// (javascript:, blob:, file:, …) resolves to undefined and renders nothing.
//
// Note an SVG loaded via <img src> never executes its scripts (unlike inline or
// <object> SVG), so data:image/svg+xml is safe here.
// =============================================================================

const HTTP_URL = /^https?:\/\//i;
// data:image/<type>[;param...](,|;base64,) — covers URL-encoded SVG (",") and base64 (";base64,").
const DATA_IMAGE = /^data:image\/[a-z0-9.+-]+[;,]/i;

/**
 * Return `src` if it is a safe image source (an http(s) URL or a data:image URI),
 * otherwise undefined. Use everywhere a module-supplied image is rendered.
 */
export function safeImageSrc(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  const s = src.trim();
  return HTTP_URL.test(s) || DATA_IMAGE.test(s) ? s : undefined;
}

/**
 * Return `url` if it is a plain http(s) URL, otherwise undefined. Used to gate a
 * module-supplied link (e.g. an author's site) before it's opened or rendered —
 * so `javascript:`/`file:`/… can never slip through.
 */
export function safeHttpUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const s = url.trim();
  return HTTP_URL.test(s) ? s : undefined;
}
