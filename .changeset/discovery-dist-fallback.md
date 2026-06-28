---
bump: minor
---

GitHub discovery now finds TypeScript modules that build to `dist/index.js`. With no
`mutka.config.json`, the discovery source previously only looked for a bare `index.js`
at the repo root — so a TS module (whose build lands in `dist/index.js`) was invisible
unless it shipped a config. The fallback now tries `index.js` then `dist/index.js`, and
de-dupes by module id so a repo carrying both isn't listed twice. Repos using
`mutka.config.json` are unaffected.
