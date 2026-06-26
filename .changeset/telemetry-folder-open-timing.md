---
bump: minor
---

Add a built-in `core.telemetry` module that times how long opening a folder takes, split into data fetch, render, and lazy icon loading. Introduces four whitelisted lifecycle events — `navigation:start`, `listing:loaded`, `listing:rendered`, `icons:settled` — that modules can subscribe to. The module logs `data=Xms render=Yms rows-ready=Zms` plus an `icons=+Nms` line per open, and can be disabled from the Modules overlay.
