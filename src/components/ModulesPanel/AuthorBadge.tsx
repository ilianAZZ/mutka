import type { CatalogAuthor } from "../../module-manager/types";
import { openExternal } from "../../module-manager/openExternal";
import { safeImageSrc, safeHttpUrl } from "../../module-manager/imageSrc";

interface AuthorBadgeProps {
  author: CatalogAuthor | null;
}

/** Avatar + name. Clicking the name opens the author's link (personal site or
 *  profile) via the OS — a plain <a> does nothing inside the Tauri webview, so
 *  it routes through openExternal. The link + avatar are scheme-checked here (the
 *  last boundary before the DOM), so a crafted value can't inject. Avatar loads
 *  lazily and decodes async. Pure presentation otherwise. */
export function AuthorBadge({ author }: AuthorBadgeProps) {
  if (!author) return null;

  const avatar = safeImageSrc(author.avatarUrl);
  const link = safeHttpUrl(author.link);
  const label = author.name ?? "";
  const inner = (
    <>
      {avatar && (
        <img className="author-badge-avatar" src={avatar} alt="" loading="lazy" decoding="async" />
      )}
      <span className="author-badge-name">{label}</span>
    </>
  );

  if (link) {
    return (
      <button
        type="button"
        className="author-badge author-badge--link"
        onClick={() => void openExternal(link)}
        title={link}
      >
        {inner}
      </button>
    );
  }
  return <span className="author-badge">{inner}</span>;
}
