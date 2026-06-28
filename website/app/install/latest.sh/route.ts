import { GITHUB_URL } from "@/app/layout.config";

// /install/latest.sh — the curl-able installer entry point advertised on the
// site:  curl -fsSL https://mutka.app/install/latest.sh | bash
//
// We don't keep a copy of the script here (it would drift). The canonical
// installer lives in the app repo at scripts/install.sh; this route redirects
// to its raw form on `main`, so the bytes a user pipes into bash are always the
// single source of truth. curl -fsSL follows the redirect (-L), as does wget.
export const dynamic = "force-static";

const RAW_INSTALL_SCRIPT = `${GITHUB_URL.replace(
  "github.com",
  "raw.githubusercontent.com",
)}/main/scripts/install.sh`;

export function GET(): Response {
  return Response.redirect(RAW_INSTALL_SCRIPT, 302);
}
