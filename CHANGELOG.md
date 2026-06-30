# Changelog

## [1.1.1](https://github.com/ilianAZZ/mutka/compare/v1.1.0...v1.1.1) (2026-06-30)


### Bug Fixes

* **file-list:** roll size units over on rounding so files near 1 MB do not show "1024.0 KB" ([749744c](https://github.com/ilianAZZ/mutka/commit/749744c4ed2699011fdbf1be8cb6a901819365dc))
* **file-list:** roll size units over on rounding so files near 1 MB don't show "1024.0 KB" ([0f3757e](https://github.com/ilianAZZ/mutka/commit/0f3757e0199c14aa6cbda5a9985907b09b09c10b))

## [1.1.0](https://github.com/ilianAZZ/mutka/compare/v1.0.0...v1.1.0) (2026-06-29)


### Features

* **cli:** run --list-actions/--run/--help as headless commands ([6af99ba](https://github.com/ilianAZZ/mutka/commit/6af99baaeff98a5306b8209ddf5575478dc5d337))
* **cli:** run --list-actions/--run/--help as headless commands ([6dc7e5f](https://github.com/ilianAZZ/mutka/commit/6dc7e5fc016adccc61e4a73d933bfff138614354)), closes [#36](https://github.com/ilianAZZ/mutka/issues/36)
* **modules:** fix module delete + visible error/success toasts ([b7db4d0](https://github.com/ilianAZZ/mutka/commit/b7db4d047a5980a9c2d681683b18d0eb8e0920af))
* **modules:** fix module delete + visible error/success toasts ([644981f](https://github.com/ilianAZZ/mutka/commit/644981f4bdabe65c52b82ff3d1efd3452d9ab501))
* **modules:** source-agnostic author (link + avatar), clickable via the OS ([d3068b8](https://github.com/ilianAZZ/mutka/commit/d3068b8063bc67bb86d016e47379744c0b4c8529))
* **modules:** source-agnostic author (link + avatar), clickable via the OS ([9efa130](https://github.com/ilianAZZ/mutka/commit/9efa1304cceba93f08718bd4fe64eff2f0d956c8))
* **sandbox:** deliver action:dispatch payload to subscribers ([567bbbe](https://github.com/ilianAZZ/mutka/commit/567bbbe33f8d417b1b877fee1e2aae4c1b2abbf1))
* **sandbox:** expose app version via sys.appVersion ([31eb2c1](https://github.com/ilianAZZ/mutka/commit/31eb2c1d70d264eb1d05a099a09f6788adfc8533))
* **telemetry:** anonymous usage reporting to PostHog ([ed959c8](https://github.com/ilianAZZ/mutka/commit/ed959c882584aeda538da839ca0a5c59be3ff227))
* **telemetry:** report anonymous usage to PostHog ([c445f64](https://github.com/ilianAZZ/mutka/commit/c445f645d6572368029e42e1109def979d48cf24))
* **updater:** add in-app update notification with progress ([5d9b17e](https://github.com/ilianAZZ/mutka/commit/5d9b17e6b0edb75fb06495afada763d5e9a1d3b9))
* **updater:** VSCode-style update notification with progress ([9ab1076](https://github.com/ilianAZZ/mutka/commit/9ab10769341dd8911dcb2abee65de6716a86cb0c))
* **website:** add "trusted by employees at" section with 5 logos ([272f1f2](https://github.com/ilianAZZ/mutka/commit/272f1f28dec71714eb5a7307b1e5ea8836314662))
* **website:** add "trusted by employees at" section with 5 logos ([338c170](https://github.com/ilianAZZ/mutka/commit/338c170197fad717215379286cf2f5ea55036cd3))


### Bug Fixes

* **backend:** poison-safe FFI locks, clean exit, drop hot-path log ([a05e4dd](https://github.com/ilianAZZ/mutka/commit/a05e4dd4106f404c9765d3970f44868dd2475307))
* **breadcrumb:** scheme-aware segmentation so virtual paths (webdav:) aren't mangled ([#34](https://github.com/ilianAZZ/mutka/issues/34)) ([30879f0](https://github.com/ilianAZZ/mutka/commit/30879f06dfdf35c8e3c033c0d0c29c16fe9cc0dc))
* **builtins:** catch floating async host calls in event handlers ([#31](https://github.com/ilianAZZ/mutka/issues/31)) ([145d5a0](https://github.com/ilianAZZ/mutka/commit/145d5a0de87e821b32299860001a651ae7f23311))
* **ci:** add pnpm-workspace.yaml so root install covers website/ ([3acd44f](https://github.com/ilianAZZ/mutka/commit/3acd44fe0e3ef57a46203b88a429fe42f718f0d0))
* **ci:** install website deps before running typedoc ([960a0c4](https://github.com/ilianAZZ/mutka/commit/960a0c4383e95966b3013c0dfe1612e2f56504e9))
* **cli:** canonicalize relative path args so `mutka .` opens the correct directory ([#35](https://github.com/ilianAZZ/mutka/issues/35)) ([a03c72a](https://github.com/ilianAZZ/mutka/commit/a03c72aa7a4db4da0ea4e7c327f392d8e4917f3b))
* **clipboard:** only 'cut' moves, and always refresh after a paste ([#32](https://github.com/ilianAZZ/mutka/issues/32)) ([4100c9d](https://github.com/ilianAZZ/mutka/commit/4100c9d4bd52460aaf66e4196ec2591a0c4ae7ce))
* **clipboard:** sync ClipboardStore after copy/cut, unique name on paste conflict ([4a94523](https://github.com/ilianAZZ/mutka/commit/4a94523d524cd06c3a05953bd1fd3a4609cc1083))
* **clipboard:** sync ClipboardStore after copy/cut, unique name on paste conflict ([8725769](https://github.com/ilianAZZ/mutka/commit/8725769f323faceb3bf37bb8f5fe1d022cb6b868))
* codebase audit hardening — crashes, blocking ops, correctness, perf ([55703d4](https://github.com/ilianAZZ/mutka/commit/55703d4ca24d30fe31a28d3ffc5b12768f8029ff))
* **context-menu:** a module isEnabled throw must not crash the whole menu ([#29](https://github.com/ilianAZZ/mutka/issues/29)) ([a808505](https://github.com/ilianAZZ/mutka/commit/a8085050a520af51f4fc9b6715e187654a093f46))
* **discovery:** log failing sources + max next-page across sources ([#24](https://github.com/ilianAZZ/mutka/issues/24),25) ([681ac96](https://github.com/ilianAZZ/mutka/commit/681ac9694b2907f2b8f4af64a1052c26007d0012))
* **drag:** resolve merge conflict — keep both shrinkIcon and safeDragIcon ([921ebc7](https://github.com/ilianAZZ/mutka/commit/921ebc75eb614e2f76bbdc57544a492e1f48659c))
* **drop-import:** skip malformed drops + don't abort the batch on one bad file ([#33](https://github.com/ilianAZZ/mutka/issues/33)) ([77c4560](https://github.com/ilianAZZ/mutka/commit/77c45606f425f9ea0b7e409f22f1e3c872d12e9b))
* **event-bus:** isolate subscriber errors so one bad handler can't starve others ([#7](https://github.com/ilianAZZ/mutka/issues/7)) ([ee1afc6](https://github.com/ilianAZZ/mutka/commit/ee1afc6a61cea0627944ec6a9b86cf6236cb07a0))
* **file-list:** prioritize internal drag over external drop, shrink drag icon ([cf039dc](https://github.com/ilianAZZ/mutka/commit/cf039dce6556ce9f9c9ca01535a9a4be16eea168))
* **file-list:** remove aggressive body click handler and duplicate drag handlers ([2a7044c](https://github.com/ilianAZZ/mutka/commit/2a7044c9f0a21044c0b96418f4125f82fa706cd0))
* **file-list:** use top positioning instead of transform on virtual rows ([d7ff71e](https://github.com/ilianAZZ/mutka/commit/d7ff71e7f6d7f5b2f9bb2cd0e830afe2610e879a))
* **file-ops:** root/scheme-safe path join + per-item delete that reports failures ([#17](https://github.com/ilianAZZ/mutka/issues/17),18) ([1fbfb8b](https://github.com/ilianAZZ/mutka/commit/1fbfb8be5974a15e8cee66e670c23e4890489ba8))
* **fs:** error on a cross-provider move instead of silently dropping files ([#6](https://github.com/ilianAZZ/mutka/issues/6)) ([d2088c6](https://github.com/ilianAZZ/mutka/commit/d2088c60b1904133b5e9db9d5355cc103cf9b314))
* **home:** fall back to home when the restored dir no longer exists ([#20](https://github.com/ilianAZZ/mutka/issues/20)) ([4fd8e98](https://github.com/ilianAZZ/mutka/commit/4fd8e9892464c6c4e77304bc3d91068c22d987e1))
* **listing:** drop a stale directory read so fast navigation can't show the wrong folder ([#16](https://github.com/ilianAZZ/mutka/issues/16)) ([a472b05](https://github.com/ilianAZZ/mutka/commit/a472b05e6d2b09a5aeb0544d767b25e11588c415))
* **sandbox:** reject in-flight calls when a worker crashes, instead of hanging forever ([#19](https://github.com/ilianAZZ/mutka/issues/19)) ([bcb6a19](https://github.com/ilianAZZ/mutka/commit/bcb6a195bf58f0d2fb70b6603e13682e84814002))
* **sandbox:** type the event whitelist against EventMap to prevent drift ([#13](https://github.com/ilianAZZ/mutka/issues/13)) ([7e7fe63](https://github.com/ilianAZZ/mutka/commit/7e7fe63158960df1c9bf0e193ec83bf7f316d9b7))
* **stores:** validate persisted localStorage values + drop dead token ([e0ea953](https://github.com/ilianAZZ/mutka/commit/e0ea9531fa962f3da585d978b25a878fdbb82540))
* **ui:** scheme-gate the dialog choose icon + native drag preview ([#21](https://github.com/ilianAZZ/mutka/issues/21),46) ([a2c70f1](https://github.com/ilianAZZ/mutka/commit/a2c70f170f048c5add4185d4311aef686427aaf9))


### Performance Improvements

* **columns:** batch custom-column cell resolution ([c0ff76a](https://github.com/ilianAZZ/mutka/commit/c0ff76a6acaabf5cc914d4a88ddf347645677a7d))
* **columns:** batch custom-column cell resolution (1 call per column, not per row) ([0aff599](https://github.com/ilianAZZ/mutka/commit/0aff5992bfd274380564d582ea41e8e6356c20bc)), closes [#25](https://github.com/ilianAZZ/mutka/issues/25)
* **columns:** memoize column/cell computation so it doesn't re-run every App render ([#10](https://github.com/ilianAZZ/mutka/issues/10)) ([24d4e7f](https://github.com/ilianAZZ/mutka/commit/24d4e7fb760eaf6250284099ef071bd8f67db7b6))
* **file-list:** virtualize rows and memo with lifted icons ([c05e992](https://github.com/ilianAZZ/mutka/commit/c05e992c2b4ffe0fce9521622c7b404fb6cc6fb4)), closes [#24](https://github.com/ilianAZZ/mutka/issues/24)
* **file-list:** virtualize rows, memo FileRow, lift icon resolution ([3237448](https://github.com/ilianAZZ/mutka/commit/3237448d4166c97d815229ce56424f9b61794da4))
* **fs:** run dir/copy/move/delete/read off the main thread + lowercase ext ([bf559c5](https://github.com/ilianAZZ/mutka/commit/bf559c55829cbe0d599dbc76c27f8890f61b624f))
* **module-registry:** sort open handlers once per module, not per insertion ([#14](https://github.com/ilianAZZ/mutka/issues/14)) ([4e02d43](https://github.com/ilianAZZ/mutka/commit/4e02d43c8505a42c9ea34a27e61f670f26ff3309))
* **watcher:** replace per-nav thread::spawn with one long-lived worker ([c7c7028](https://github.com/ilianAZZ/mutka/commit/c7c7028bce1884aad68e6eee10dbb75f64fccb00))
* **watcher:** replace per-nav thread::spawn with one long-lived worker ([907d122](https://github.com/ilianAZZ/mutka/commit/907d1220b35d865ab6188b92453526aeb262ec8f)), closes [#27](https://github.com/ilianAZZ/mutka/issues/27)

## [1.0.0](https://github.com/ilianAZZ/mutka/compare/v0.2.0...v1.0.0) (2026-06-28)


### ⚠ BREAKING CHANGES

* stabilize the module API for the first stable release

### Features

* add dev community modules for folder inspection, image dimensions, SQLite browsing, and WebDAV support ([31e376f](https://github.com/ilianAZZ/mutka/commit/31e376f3da37d89ca6cf103826431542c4dbad5c))
* add DownloadIcon component and enhance HomePage layout with GitHub and download links ([ce50f78](https://github.com/ilianAZZ/mutka/commit/ce50f78f112aa366b49aadd148505029601f512d))
* add feature articles and visuals components ([b9f2bfd](https://github.com/ilianAZZ/mutka/commit/b9f2bfd504ff09de4e73e2e26c47228fa675a850))
* **cli:** add CLI support — mutka &lt;path&gt;, --picker, --run, --list-actions ([56feab2](https://github.com/ilianAZZ/mutka/commit/56feab24381d16e10666d9aa4aaadcb1e754168f))
* **create-module:** ship a build workflow so discovery finds TS modules ([5a951b8](https://github.com/ilianAZZ/mutka/commit/5a951b8a199fee5e28f2093854c191eba446e0de))
* **create-module:** ship a build workflow so discovery finds TS modules ([2f178fe](https://github.com/ilianAZZ/mutka/commit/2f178feb3a7e0fb91cc3c106e535c251e9cf7f07))
* **discovery:** fall back to dist/index.js for TS modules ([6cde555](https://github.com/ilianAZZ/mutka/commit/6cde555470a0a17313cb013de553bc4961311e64))
* **discovery:** transform module discovery into a pluggable module system ([746f2ab](https://github.com/ilianAZZ/mutka/commit/746f2ab99ed1db0da6e09a18708141f16f3147a0))
* **docs:** update installation instructions and permissions for modules ([56a9c4a](https://github.com/ilianAZZ/mutka/commit/56a9c4afc24d27ef3041c68dbf1be68b5ef45382))
* **events:** expand event whitelist for sandboxed modules with two tiers ([ac498cd](https://github.com/ilianAZZ/mutka/commit/ac498cd722ff6bbe38f9fcd4544aab369db8de7e))
* **icons:** improve folder opening speed by rendering icons off the main thread and caching ([f84d1f6](https://github.com/ilianAZZ/mutka/commit/f84d1f6e550db704df31d0e98a976718f7488f5c))
* **modules:** infer command ids → type-check host.onCommand ([5877d97](https://github.com/ilianAZZ/mutka/commit/5877d9727047065481bf0e40e7dab415bae1eb37))
* **modules:** infer command ids → type-check host.onCommand ([b8499cd](https://github.com/ilianAZZ/mutka/commit/b8499cd27c664883cce0868b029579f57f8b3157))
* **modules:** install a local index.js from the explorer context menu ([994d32e](https://github.com/ilianAZZ/mutka/commit/994d32e8372fec09fd9fb9fe3dcbabee11b3b402))
* **modules:** make the install review update-aware ([f928aa4](https://github.com/ilianAZZ/mutka/commit/f928aa4b5e3b56a718b29353f50002a1050f1b6f))
* **modules:** module-contributed buttons + a Mutka file picker (local install Stage 2) ([f9339c8](https://github.com/ilianAZZ/mutka/commit/f9339c8ef100832fe04b3759b3c06c3286b8ca37))
* **modules:** pluggable discovery registry + richer module cards ([715364f](https://github.com/ilianAZZ/mutka/commit/715364f17fa3da04482f2c40b7655b2125fd0cc8))
* **modules:** typed host + [@mutka-explorer](https://github.com/mutka-explorer) npm tooling for authors ([60b41ac](https://github.com/ilianAZZ/mutka/commit/60b41accd83390d875b05328243f24a8328dffb7))
* **modules:** typed host + [@mutka-explorer](https://github.com/mutka-explorer) npm tooling for authors ([e4a282d](https://github.com/ilianAZZ/mutka/commit/e4a282d129734f84c602a33153b01b6c1bbfe0a9))
* **permissions:** split network into network:public / network:local tiers ([b01c396](https://github.com/ilianAZZ/mutka/commit/b01c3969871ea42310355fba4bbb16591d5f239a))
* **picker:** add mode option (file/folder/any) to file picker ([462f37a](https://github.com/ilianAZZ/mutka/commit/462f37a234f3576fca5fd646ce984c3b1bfb7ce8))
* stabilize the module API for the first stable release ([1fe13cc](https://github.com/ilianAZZ/mutka/commit/1fe13cc42069f45d4f9555c1e62f7cc4d2ab22d4))
* **telemetry:** add core.telemetry module to track folder open timing with lifecycle events ([125ed48](https://github.com/ilianAZZ/mutka/commit/125ed48a15e8610d7aee04c576cc414d15852603))


### Bug Fixes

* **build:** drop deprecated cocoa crate, silence objc cfg warnings ([ed9b3ca](https://github.com/ilianAZZ/mutka/commit/ed9b3ca8fa5eb8289df2aaf2868e4f13f21642b6))
* **cli:** add missing trait imports and Result return types ([d2738f6](https://github.com/ilianAZZ/mutka/commit/d2738f60610e053d99d3fa97909bcbd8df34d34e))
* **cli:** remove unsupported `long` field from CLI arg config ([b1a8881](https://github.com/ilianAZZ/mutka/commit/b1a88813e9932116f510ee094a2b0f21c0a10da0))
* **create-module:** force-add dist in the build workflow ([613cfc9](https://github.com/ilianAZZ/mutka/commit/613cfc9e8cb3e43449cd5ec42289d5875de9d46e))
* **module-sdk:** keep author-facing types React-free (no react dep) ([28e9cdc](https://github.com/ilianAZZ/mutka/commit/28e9cdca476d84ab5e0bdbc87598357e5ffabee1))
* **module-sdk:** keep author-facing types React-free (no react dep) ([355e220](https://github.com/ilianAZZ/mutka/commit/355e2203e7ebcaba86ab40e49249d6f88edee689))
* **module-sdk:** keep author-facing types React-free (no react dep) ([34f3387](https://github.com/ilianAZZ/mutka/commit/34f33874a45312215ee8c2018889241ff16bb564))
* **modules:** cap module source size on install, read, and probe (5 MiB) ([c025de8](https://github.com/ilianAZZ/mutka/commit/c025de8c107286306f5f252688cf266816fb5e2c))
* **network:** make the network capability pure I/O (one role, one permission) ([7da819d](https://github.com/ilianAZZ/mutka/commit/7da819d4b62ae97682030eaf6537a4042a8e8b60))
* **picker:** clarify button labels — "Open Current Folder" vs "Open &lt;file&gt;" ([89cf7ef](https://github.com/ilianAZZ/mutka/commit/89cf7eff1544c982a88432c33931d386f23c990d))
* **release:** create annotated tag so --follow-tags pushes it ([09816a9](https://github.com/ilianAZZ/mutka/commit/09816a94a44d78b719e49eadbdb6c60105efe4ae))
* **security:** disable withGlobalTauri (drop the ambient window.__TAURI__) ([3c875c3](https://github.com/ilianAZZ/mutka/commit/3c875c35195fa679352221dddd515540e39a754b))
* **security:** force module network egress through the gated host.net via CSP ([325b3f7](https://github.com/ilianAZZ/mutka/commit/325b3f7113e2dbd7643485cfaabb93ad77373bc6))
* **security:** no redirect-following, tighter IP tiers, config + module-file isolation ([e68c6f5](https://github.com/ilianAZZ/mutka/commit/e68c6f504d008e674b9da90e1d22d2ac1e40cb37))
* **security:** require fs:read to receive file:external-drop (it carries file bytes) ([3a15ce2](https://github.com/ilianAZZ/mutka/commit/3a15ce2ad9b992537dcc79d417f0d3362b82b01a))
* **sidebar:** ensure activeId syncs correctly on tab click ([b82f980](https://github.com/ilianAZZ/mutka/commit/b82f98035da697f96d9aa30779f2fe5d889e504b))

## 0.2.0 — 2026-06-26

### Minor

- Add changeset to handle versionning and auto release pipeline
- Manage modules with UI, store config in home dir
