---
bump: patch
---

Fix sidebar panel needing two clicks to collapse: the tab toggle now compares against the panel actually on screen, so panels that register after mount (e.g. a right-side panel rendered on app:ready) collapse on the first click.
