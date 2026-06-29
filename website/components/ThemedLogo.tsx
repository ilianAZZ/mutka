"use client";

import { useEffect, useState } from "react";
import { useTheme } from "fumadocs-ui/provider/base";

/**
 * Picks a logo asset by the active theme. Theme-dependent asset selection
 * belongs in JS (next-themes), not CSS: a double-rendered "hide one with
 * display:none" approach is fragile — Turbopack drops those rules in dev.
 *
 * Renders the light asset until mounted so server and first client render
 * agree (no hydration mismatch), then swaps to the dark asset in dark mode.
 */
export function ThemedLogo({
  light,
  dark,
  alt,
  height,
}: {
  light: string;
  dark: string;
  alt: string;
  height: string;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const src = mounted && resolvedTheme === "dark" ? dark : light;

  return (
    <img
      src={src}
      alt={alt}
      className="w-auto"
      style={{ height }}
      loading="lazy"
      decoding="async"
    />
  );
}
