import Link from "next/link";
import type { CtaLink } from "@/lib/features/types";

/** Renders a row of feature-page call-to-action buttons from data. */
export function CtaButtons({ links }: { links: CtaLink[] }) {
  if (!links.length) return null;
  return (
    <div className="ft-cta-row">
      {links.map((l) => {
        const cls = `ft-btn ft-btn--${l.variant ?? "primary"}`;
        return l.external ? (
          <a key={l.href} href={l.href} className={cls} target="_blank" rel="noreferrer">
            {l.label}
          </a>
        ) : (
          <Link key={l.href} href={l.href} className={cls}>
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
