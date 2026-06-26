import type { VisualName } from "@/lib/features/types";

// On-brand CSS illustrations for split blocks. Real screenshots can replace
// these later via a SplitSection's `image` field; until then each keyed visual
// is a lightweight, themeable mock that matches the product's look.

function Permissions() {
  const rows: [string, boolean][] = [
    ["fs:read", true],
    ["clipboard:write", true],
    ["ui", true],
    ["network", false],
    ["fs:write", false],
  ];
  return (
    <div className="fv-card" aria-hidden="true">
      <div className="fv-card-h">permissions</div>
      <ul className="fv-perm">
        {rows.map(([p, ok]) => (
          <li key={p} className={ok ? "fv-perm--ok" : "fv-perm--no"}>
            <span className="fv-perm-mark">{ok ? "✓" : "✗"}</span>
            <code>{p}</code>
            <span className="fv-perm-tag">{ok ? "granted" : "denied"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Gateway() {
  return (
    <div className="fv-card fv-gate" aria-hidden="true">
      <div className="fv-gate-node fv-gate-mod">module</div>
      <div className="fv-gate-flow">
        <span className="fv-gate-call">host.fs.write()</span>
        <span className="fv-gate-arrow">→</span>
      </div>
      <div className="fv-gate-bar">
        <span>GATEWAY</span>
        <em>checks permissions</em>
      </div>
      <div className="fv-gate-out">
        <span className="fv-gate-ok">✓ fs:read</span>
        <span className="fv-gate-no">✗ fs:write</span>
      </div>
    </div>
  );
}

function Modules() {
  const tiles = ["⧉", "✂", "↻", "⌘", "☁", "+"];
  return (
    <div className="fv-card fv-tiles" aria-hidden="true">
      {tiles.map((t, i) => (
        <span key={i} className={`fv-tile${t === "+" ? " fv-tile--ghost" : ""}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

function Window() {
  const files: [string, string][] = [
    ["Documents", "folder"],
    ["report.sqlite", "table"],
    ["photo.png", "image"],
    ["notes.txt", "12 words"],
  ];
  return (
    <div className="fv-card fv-win" aria-hidden="true">
      <div className="fv-win-bar">
        <i style={{ background: "#ff5f57" }} />
        <i style={{ background: "#febc2e" }} />
        <i style={{ background: "#28c840" }} />
        <span>~/.mutka</span>
      </div>
      {files.map(([name, kind]) => (
        <div key={name} className="fv-win-row">
          <span className="fv-win-name">{name}</span>
          <span className="fv-win-kind">{kind}</span>
        </div>
      ))}
    </div>
  );
}

function Manager() {
  return (
    <div className="fv-card" aria-hidden="true">
      <div className="fv-card-h">install review</div>
      <div className="fv-mgr-id">com.sqlite-browser</div>
      <ul className="fv-perm">
        <li className="fv-perm--ok">
          <span className="fv-perm-mark">✓</span>
          <code>fs:read</code>
          <span className="fv-perm-tag">safe</span>
        </li>
        <li className="fv-perm--no">
          <span className="fv-perm-mark">!</span>
          <code>network</code>
          <span className="fv-perm-tag">review</span>
        </li>
      </ul>
      <div className="fv-mgr-actions">
        <span className="fv-mgr-btn fv-mgr-btn--go">Install</span>
        <span className="fv-mgr-btn">Cancel</span>
      </div>
    </div>
  );
}

function Ai() {
  return (
    <div className="fv-card fv-ai" aria-hidden="true">
      <div className="fv-card-h">✦ prompt</div>
      <p className="fv-ai-prompt">“Add a Word count column for .txt files.”</p>
      <div className="fv-ai-out">
        <span className="tok-key">export default</span>{" "}
        <span className="tok-fn">defineModule</span>(
        {"{ "}
        <span className="tok-prop">id</span>:{" "}
        <span className="tok-str">&quot;ai.wordcount&quot;</span>… {"})"}
      </div>
    </div>
  );
}

const VISUALS: Record<VisualName, () => React.ReactElement> = {
  permissions: Permissions,
  gateway: Gateway,
  modules: Modules,
  window: Window,
  manager: Manager,
  ai: Ai,
};

/** Renders the keyed illustration for a split section. */
export function FeatureVisual({ name }: { name: VisualName }) {
  const C = VISUALS[name];
  return (
    <div className="fv">
      <C />
    </div>
  );
}
