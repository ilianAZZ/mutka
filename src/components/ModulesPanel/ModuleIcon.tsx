import { safeImageSrc } from "../../module-manager/imageSrc";

interface ModuleIconProps {
  /** An http(s) URL or a data:image URI. When absent/unsafe, a lettered fallback shows. */
  icon?: string;
  /** Module name — drives the fallback letter. */
  name: string;
}

/** A module's square image, or a lettered fallback tile. Pure presentation.
 *  Loads lazily and decodes async so a list of cards never blocks on images. */
export function ModuleIcon({ icon, name }: ModuleIconProps) {
  const src = safeImageSrc(icon);
  if (src) {
    return <img className="module-icon" src={src} alt="" loading="lazy" decoding="async" />;
  }
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="module-icon module-icon--fallback" aria-hidden>
      {letter}
    </span>
  );
}
