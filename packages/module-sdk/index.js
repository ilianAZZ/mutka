// Runtime for @mutka-explorer/module.
//
// The ONLY runtime export is `defineModule`, an identity function — it exists
// purely so TypeScript can infer your `commands[].id`s and type `host.onCommand`
// to them (all the typing lives in index.d.ts). A bundler inlines this call, so
// an authored module's built `index.js` stays import-free and self-contained.
export const defineModule = (def) => def;
