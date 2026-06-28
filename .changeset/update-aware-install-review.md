---
bump: patch
---

The install-review dialog now recognizes when a module id is already installed and
presents it as an **Update** (showing `vOld → vNew`) or a **Reinstall** (same
version) instead of a plain "Install" — with a note that the current version will be
replaced. Applies to every install path (GitHub Browse and local-file), since it's the
shared review dialog. `ModuleManager.install` already replaced the old runtime; this
just makes the action clear before the user confirms.
