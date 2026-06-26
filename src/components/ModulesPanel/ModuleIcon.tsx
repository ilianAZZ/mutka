interface ModuleIconProps {
  /** A data: URI or https URL. When absent, a lettered fallback is shown. */
  icon?: string;
  /** Module name — drives the fallback letter. */
  name: string;
}

/** A module's square image, or a lettered fallback tile. Pure presentation. */
export function ModuleIcon({ icon, name }: ModuleIconProps) {
  if (icon) {
    return <img className="module-icon" src={icon} alt="" loading="lazy" />;
  }
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="module-icon module-icon--fallback" aria-hidden>
      {letter}
    </span>
  );
}
