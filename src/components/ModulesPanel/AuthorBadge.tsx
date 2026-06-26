import type { CatalogAuthor } from "../../module-manager/types";

interface AuthorBadgeProps {
  author: CatalogAuthor | null;
}

/** Avatar + name linking to the author's GitHub profile/org. Pure presentation. */
export function AuthorBadge({ author }: AuthorBadgeProps) {
  if (!author) return null;

  const label = author.name ?? (author.github ? `@${author.github}` : "");
  const inner = (
    <>
      {author.avatarUrl && (
        <img className="author-badge-avatar" src={author.avatarUrl} alt="" loading="lazy" />
      )}
      <span className="author-badge-name">{label}</span>
    </>
  );

  if (author.profileUrl) {
    return (
      <a
        className="author-badge"
        href={author.profileUrl}
        target="_blank"
        rel="noreferrer"
        title={author.github ? `@${author.github}` : label}
      >
        {inner}
      </a>
    );
  }
  return <span className="author-badge">{inner}</span>;
}
