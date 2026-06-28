// Minimal interactive prompts over Node's built-in readline — no dependencies,
// so the CLI runs instantly via npx with nothing to install.
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

/** Ask a free-text question with an optional default shown in brackets. */
export async function ask(question, fallback = "") {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const hint = fallback ? ` (${fallback})` : "";
    const answer = (await rl.question(`${question}${hint}: `)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

/** Ask a yes/no question. Returns a boolean; `def` is used on empty input. */
export async function confirm(question, def = true) {
  const ans = (await ask(`${question} ${def ? "[Y/n]" : "[y/N]"}`)).toLowerCase();
  if (!ans) return def;
  return ans.startsWith("y");
}
