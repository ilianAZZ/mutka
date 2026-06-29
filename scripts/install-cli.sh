#!/bin/bash
# Install the `mutka` CLI shim to /usr/local/bin so the app binary is on PATH.
# Usage: bash scripts/install-cli.sh

set -euo pipefail

APP_PATH="/Applications/Mutka.app/Contents/MacOS/Mutka"
DEST="/usr/local/bin/mutka"

if [ ! -f "$APP_PATH" ]; then
  echo "Mutka.app not found at /Applications/Mutka.app"
  echo "Install Mutka first, then re-run this script."
  exit 1
fi

if [ -L "$DEST" ] || [ -f "$DEST" ]; then
  echo "Replacing existing $DEST"
fi

sudo ln -sf "$APP_PATH" "$DEST"
echo "Installed: $DEST → $APP_PATH"
echo ""
echo "Usage:"
echo "  mutka --help           List all commands"
echo "  mutka <path>           Navigate to a directory"
echo "  mutka --picker         Pick a file/folder (outputs path to stdout)"
echo "  mutka --run <action>   Run a module action"
echo "  mutka --list-actions   List all available actions"
