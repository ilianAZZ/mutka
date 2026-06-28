#!/usr/bin/env node
// Entry point for `npm create @mutka-explorer` / `npx @mutka-explorer/create`.
import { main } from "../lib/main.mjs";

main(process.argv.slice(2)).catch((err) => {
  console.error(`\n✖ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
