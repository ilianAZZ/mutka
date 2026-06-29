interface FileIconProps {
  src: string | null;
  isSymlink: boolean;
}

export function FileIcon({ src, isSymlink }: FileIconProps): JSX.Element {
  return (
    <span className="file-icon">
      {src ? (
        <img className="file-icon-img" src={src} alt="" draggable={false} />
      ) : (
        <span className="file-icon-placeholder" aria-hidden="true" />
      )}
      {isSymlink && <span className="file-icon-symlink" aria-label="Alias">↗</span>}
    </span>
  );
}
