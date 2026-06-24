import "./Breadcrumb.css";

interface Props {
  path: string;
  onNavigate: (path: string) => void;
}

export function Breadcrumb({ path, onNavigate }: Props) {
  const segments = path.split("/").filter(Boolean);

  return (
    <div id="breadcrumb">
      <button className="breadcrumb-segment" onClick={() => onNavigate("/")}>
        /
      </button>
      {segments.map((seg, i) => {
        const segPath = "/" + segments.slice(0, i + 1).join("/");
        return (
          <span key={segPath} className="breadcrumb-item">
            <span className="breadcrumb-sep">/</span>
            <button
              className="breadcrumb-segment"
              onClick={() => onNavigate(segPath)}
            >
              {seg}
            </button>
          </span>
        );
      })}
    </div>
  );
}
