---
bump: patch
---

Silence Rust build warnings: whitelist the bogus `cargo-clippy` cfg emitted by the `objc` macros, and drop the deprecated `cocoa` crate by rewriting the traffic-light positioning in raw `objc` like the other macOS modules.
