"use client";

import { useState } from "react";

const COMMAND = "curl -fsSL https://mutka.app/install/latest.sh | bash";

/** Hero install one-liner with a copy button. Downloads + installs the latest
 *  signed & notarized macOS release into /Applications. */
export function InstallCommand() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — user can still select the text manually */
    }
  }

  return (
    <div className="install-cmd">
      <code className="install-cmd__text">
        <span className="install-cmd__prompt">$</span> {COMMAND}
      </code>
      <button
        type="button"
        className="install-cmd__copy"
        onClick={copy}
        aria-label="Copy install command"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
