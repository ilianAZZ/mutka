import { getDocEntries } from "@/lib/docs-content";
import { SITE_URL, DESCRIPTION } from "@/lib/site";

// /llms-full.txt — the entire documentation as one plain-text markdown stream,
// for LLMs that want the full corpus in a single fetch. Statically generated.
export const dynamic = "force-static";

export function GET(): Response {
  const entries = getDocEntries();

  const header = [
    "# Mutka — Full Documentation",
    "",
    `> ${DESCRIPTION}`,
    "",
    `Source: ${SITE_URL} · Generated from the Mutka documentation.`,
    "",
  ].join("\n");

  const sections = entries.map((e) =>
    [
      "---",
      "",
      `# ${e.title}`,
      `URL: ${SITE_URL}${e.url}`,
      e.description ? `\n${e.description}` : "",
      "",
      e.body,
      "",
    ].join("\n"),
  );

  const body = `${header}\n${sections.join("\n")}`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
