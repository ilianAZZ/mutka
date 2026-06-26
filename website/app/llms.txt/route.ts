import { getDocEntries } from "@/lib/docs-content";
import { GITHUB_URL, DISCORD_URL } from "@/app/layout.config";
import { SITE_URL, DESCRIPTION } from "@/lib/site";

// /llms.txt — the llmstxt.org curated index: a short overview plus a flat,
// link-with-summary map of the documentation, so an LLM can find what it needs
// without crawling the rendered site. Statically generated (runs at build).
export const dynamic = "force-static";

function link(url: string, title: string, description: string): string {
  const abs = url.startsWith("http") ? url : `${SITE_URL}${url}`;
  return description ? `- [${title}](${abs}): ${description}` : `- [${title}](${abs})`;
}

export function GET(): Response {
  const entries = getDocEntries();
  const guides = entries.filter((e) => !e.isApi);

  const body = [
    "# Mutka",
    "",
    `> ${DESCRIPTION}`,
    "",
    "Mutka is a native macOS file explorer built with Tauri 2 and React. The",
    "core provides only infrastructure — a module registry, an event bus, a",
    "shortcut manager and a permission-checked gateway. Every real feature",
    "(copy/paste, navigation, columns, cloud mounts) is a module. A module is a",
    "single ESM file that exports `defineModule({ id, permissions, commands,",
    "openHandlers, setup })`, imports nothing from the core, and reaches the",
    "system only through a permission-gated `host` object — a shape small enough",
    "for an AI to generate reliably.",
    "",
    "## Documentation",
    "",
    ...guides.map((e) => link(e.url, e.title, e.description)),
    "",
    "## API Reference",
    "",
    link(
      "/docs/api",
      "API Reference",
      "Auto-generated type reference for the Mutka module API (defineModule, the host proxy, permissions and core types).",
    ),
    "",
    "## Optional",
    "",
    link(
      "/llms-full.txt",
      "Full documentation",
      "Every documentation page concatenated as plain markdown.",
    ),
    link(GITHUB_URL, "GitHub repository", "Source code, issues and releases."),
    link(DISCORD_URL, "Discord", "Community chat and module help."),
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
