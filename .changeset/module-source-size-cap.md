---
bump: patch
---

Cap a module's `index.js` at 5 MiB on install, read, and probe. A module is a single
ESM file, so the bound is generous, but it stops a hostile or accidentally-huge source
from bloating disk or the throwaway probe worker. Enforced in `install_module` /
`read_module_file` (Rust) and `probeManifest` (which also gates the discovery
`modules.probe` path).
