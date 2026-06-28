---
bump: patch
---

Keep the author-facing types React-free. `ModulePermission`, `SidebarItem`,
`SidebarItemGroup`, and `SidebarCategories` moved from `module-registry.types.ts`
(which imports `react` for the core-only `MutkaSidebarPanel`) into a new framework-free
`module-registry/public-types.ts`, re-exported from the old module so in-app imports are
unchanged. The SDK-reachable files (`defineModule`, `hostProxy`, `protocol`,
`discovery/types`) now import them from there, so the generated `@mutka-explorer/module`
types build carries no React dependency.
