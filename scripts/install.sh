#!/bin/bash
# Mutka installer — download the latest release, install to /Applications, and
# (best-effort) add the `mutka` CLI to PATH. The release is signed with a
# Developer ID and notarized, so it opens with a normal double-click.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ilianAZZ/mutka/main/scripts/install.sh | bash
#   # or, once the domain is wired up:
#   curl -fsSL https://mutka.app/install/latest.sh | bash

set -euo pipefail

REPO="ilianAZZ/mutka"
APP_NAME="Mutka.app"
TARBALL="Mutka_universal.app.tar.gz"
URL="https://github.com/$REPO/releases/latest/download/$TARBALL"
DEST="/Applications"
APP_PATH="$DEST/$APP_NAME"
CLI_DEST="/usr/local/bin/mutka"

if [ "$(uname)" != "Darwin" ]; then
  echo "Mutka is macOS only." >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Downloading the latest Mutka release…"
curl -fsSL "$URL" -o "$TMP/$TARBALL"

echo "→ Extracting…"
tar -xzf "$TMP/$TARBALL" -C "$TMP"

if [ -d "$APP_PATH" ]; then
  echo "→ Removing the previous install at $APP_PATH"
  rm -rf "$APP_PATH"
fi

echo "→ Installing to $DEST"
mv "$TMP/$APP_NAME" "$DEST/"

# Best-effort CLI shim so `mutka <path>` works from the terminal. Needs sudo to
# write to /usr/local/bin; if that fails we print the manual step instead of
# aborting the whole install.
APP_BIN="$APP_PATH/Contents/MacOS/Mutka"
if ln -sf "$APP_BIN" "$CLI_DEST" 2>/dev/null || sudo ln -sf "$APP_BIN" "$CLI_DEST" 2>/dev/null; then
  echo "→ Installed the 'mutka' CLI at $CLI_DEST"
  CLI_OK=1
else
  CLI_OK=0
fi

echo ""
echo "✓ Mutka is installed in $DEST"
echo "  Launch it from Spotlight or: open -a Mutka"
if [ "$CLI_OK" = "1" ]; then
  echo ""
  echo "CLI usage:"
  echo "  mutka --help           List all commands"
  echo "  mutka <path>           Open a directory"
  echo "  mutka --picker         Pick a file/folder (path → stdout)"
  echo "  mutka --run <action>   Run a module action"
  echo "  mutka --list-actions   List all available actions"
else
  echo ""
  echo "Couldn't install the 'mutka' CLI automatically. To add it manually:"
  echo "  sudo ln -sf \"$APP_BIN\" $CLI_DEST"
fi
