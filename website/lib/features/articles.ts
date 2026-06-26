// The feature-article registry — pure content, no rendering. Each entry is a
// `FeatureArticle` made of modular `Section`s (see ./types). The route at
// app/features/[slug] looks articles up here; the hub at app/features lists
// them. Adding a feature page = adding one object to this array.

import type { FeatureArticle } from "./types";

const SAFETY: FeatureArticle = {
  slug: "safety",
  label: "Safety",
  title: "Safe by design — the permission sandbox",
  description:
    "Every Mutka module declares the capabilities it needs; anything it didn't ask for is physically unreachable. Untrusted modules run isolated in a Web Worker behind a single permission gateway.",
  hook: "A module only ever gets the access it declared — everything else is denied at the gateway.",
  topics: ["Permissions", "Web Worker isolation", "One gateway"],
  accent: "#30d158",
  badge: "✓",
  datePublished: "2026-06-27",
  dateModified: "2026-06-27",
  related: ["modular-architecture", "extension-manager", "ai-built-modules"],
  sections: [
    {
      kind: "hero",
      kicker: "deny by default",
      title: "Safe by design",
      subtitle:
        "Installing a third-party module shouldn't mean handing it your whole filesystem. In Mutka a module receives exactly the capabilities it declares — and a denied permission isn't just refused, it's unreachable.",
      badges: ["Permission-sandboxed", "Isolated Web Workers", "One gateway"],
      cta: [
        { label: "Read the permissions docs", href: "/docs/modules/permissions", variant: "primary" },
        { label: "See all features", href: "/features", variant: "ghost" },
      ],
    },
    {
      kind: "prose",
      heading: "The problem with plugins",
      lede: true,
      body: [
        "Most extensible apps grant plugins the same power as the app itself. A plugin that should only count words can usually also read your SSH keys, phone home, or delete a folder — because nothing stands between it and the system.",
        "Mutka takes the opposite stance. The core ships only infrastructure; every feature is a module, and every module states up-front the precise capabilities it needs. The system grants those and nothing more.",
      ],
    },
    {
      kind: "split",
      heading: "Permissions are a declared contract",
      media: "right",
      visual: "permissions",
      body: [
        "A module is a single file that exports `defineModule({ id, permissions, … })`. The `permissions` array is the whole story: it's the complete list of what the module is allowed to touch.",
        "When the module calls `host.fs.write()` or `host.net.fetch()`, the gateway checks that call against the declared list. If the matching permission isn't there, the call throws before it ever reaches the system.",
      ],
      bullets: [
        "fs:read / fs:write / fs:temp — scoped filesystem access",
        "clipboard:read / clipboard:write — the macOS pasteboard",
        "navigation, dialog, ui, network, storage, secrets",
        "Anything not listed is denied — there is no implicit access",
      ],
    },
    {
      kind: "split",
      heading: "Untrusted code runs in a real sandbox",
      media: "left",
      visual: "gateway",
      body: [
        "Trusted built-ins run in-process for speed. Community modules you install run isolated in a Web Worker: no DOM, no `invoke`, no reference to the core. Their only line to the system is a `postMessage` channel.",
        "That means a denied capability isn't a polite refusal — the worker has no way to perform it at all. The permission gateway is the single, auditable choke point every privileged call must pass through.",
      ],
      cta: [
        { label: "How the sandbox works", href: "/docs/architecture", variant: "primary" },
      ],
    },
    {
      kind: "code",
      heading: "What a blocked call looks like",
      caption: "A module that only declared fs:read cannot write — the gateway throws.",
      lines: [
        [
          { t: "export default", cls: "tok-key" },
          { t: " defineModule", cls: "tok-fn" },
          { t: "({", cls: "tok-punc" },
        ],
        [
          { t: "  id", cls: "tok-prop" },
          { t: ": ", cls: "tok-punc" },
          { t: '"com.word-count"', cls: "tok-str" },
          { t: ",", cls: "tok-punc" },
        ],
        [
          { t: "  permissions", cls: "tok-prop" },
          { t: ": [", cls: "tok-punc" },
          { t: '"fs:read"', cls: "tok-str" },
          { t: "],", cls: "tok-punc" },
          { t: "   // the whole allow-list", cls: "tok-com" },
        ],
        [
          { t: "  setup", cls: "tok-fn" },
          { t: "(host) {", cls: "tok-punc" },
        ],
        [
          { t: "    host.fs.", cls: "tok-punc" },
          { t: "readDir", cls: "tok-fn" },
          { t: "(path);", cls: "tok-punc" },
          { t: "   // ✓ allowed", cls: "tok-com" },
        ],
        [
          { t: "    host.fs.", cls: "tok-punc" },
          { t: "deleteItem", cls: "tok-fn" },
          { t: "(path);", cls: "tok-punc" },
          { t: "  // ✗ throws: fs:write not granted", cls: "tok-com" },
        ],
        [{ t: "  }", cls: "tok-punc" }],
        [{ t: "});", cls: "tok-punc" }],
      ],
    },
    {
      kind: "grid",
      heading: "Three layers, one guarantee",
      intro: "Safety in Mutka isn't a setting you can forget to enable — it falls out of the architecture.",
      items: [
        {
          title: "Declared up front",
          body: "Permissions live in the manifest, visible before you install. Nothing is requested silently at runtime.",
          badge: "1",
          color: "#30d158",
        },
        {
          title: "Physically isolated",
          body: "Community modules run in a Web Worker with no system handles — capabilities they lack simply don't exist for them.",
          badge: "2",
          color: "#0a84ff",
        },
        {
          title: "Centrally gated",
          body: "One gateway checks every privileged call. To audit what's possible, you read a single file.",
          badge: "3",
          color: "#bf5af2",
        },
      ],
    },
    {
      kind: "callout",
      title: "You approve before anything installs",
      body: "When you install a module, Mutka shows its full permission list and flags the dangerous ones. You see exactly what you're granting — and you can disable or delete the module at any time, live, with no restart.",
      color: "#30d158",
    },
    {
      kind: "faq",
      heading: "Frequently asked",
      items: [
        {
          q: "Can a module access files I didn't open?",
          a: "Only if it declared fs:read or fs:write. Without those permissions the filesystem capabilities are never wired into the module, so the calls don't exist to be made.",
        },
        {
          q: "Can a module phone home or send my data over the network?",
          a: "Not unless it declared the network permission, which is shown in the install review. A module without it has no network capability at all.",
        },
        {
          q: "What stops a malicious module from bypassing the gateway?",
          a: "Untrusted modules run in an isolated Web Worker with no reference to the core, no DOM and no invoke bridge. The only way out is the postMessage channel, and every message is checked against the declared permissions.",
        },
        {
          q: "Can I revoke access after installing?",
          a: "Yes. Disabling a module tears down its worker immediately, and uninstalling removes it from disk. Every change is applied live without restarting the app.",
        },
      ],
    },
    {
      kind: "cta",
      heading: "Build something powerful — safely",
      body: "Read how the permission model works, then write your first sandboxed module.",
      color: "#30d158",
      links: [
        { label: "Permissions reference", href: "/docs/modules/permissions", variant: "primary" },
        { label: "Write a module", href: "/docs/modules/writing-a-module", variant: "ghost" },
      ],
    },
  ],
};

const MODULAR: FeatureArticle = {
  slug: "modular-architecture",
  label: "Modular architecture",
  title: "Built entirely out of modules",
  description:
    "Mutka keeps a tiny core and ships every feature — even copy-paste and navigation — as a single-file module. The built-ins and the add-ons you install are written the exact same way.",
  hook: "Even copy-paste and navigation are modules. The core is just infrastructure.",
  topics: ["One format", "Two runtimes", "Zero core imports"],
  accent: "#0a84ff",
  badge: "◍",
  datePublished: "2026-06-27",
  dateModified: "2026-06-27",
  related: ["extension-manager", "safety", "ai-built-modules"],
  sections: [
    {
      kind: "hero",
      kicker: "no fork required",
      title: "A file explorer made of modules",
      subtitle:
        "Mutka's core ships only infrastructure: a registry, an event bus, a shortcut manager and a permission gateway. Every real feature is a module — and anyone can add one without forking the app or touching core code.",
      badges: ["One-file modules", "Zero core imports", "Live enable / disable"],
      cta: [
        { label: "Write your first module", href: "/docs/modules/writing-a-module", variant: "primary" },
        { label: "Read the architecture", href: "/docs/architecture", variant: "ghost" },
      ],
    },
    {
      kind: "prose",
      heading: "The core does almost nothing — on purpose",
      lede: true,
      body: [
        "A smaller core is a more reliable core. Mutka's infrastructure layer never contains feature logic: no copy, no rename, no navigate. It provides the seams — a module registry, a typed event bus, a shortcut manager and a permission-checked gateway — and gets out of the way.",
        "Everything a user actually does is a module snapping onto those seams. Copy and paste, file creation, tabs, cloud mounts, list columns — all of it lives outside the core, in files that import nothing from Mutka.",
      ],
    },
    {
      kind: "split",
      heading: "One format the whole way down",
      media: "right",
      visual: "modules",
      body: [
        "A module is a plain file that exports `defineModule({ id, name, permissions, commands, openHandlers, setup })`. Inside `setup(host)` it receives a `host` object — its only window onto the system.",
        "There is no privileged \"official\" API. The clipboard that ships in the box and a community module you write tonight use the exact same shape. If a built-in can do it, your module can too.",
      ],
      bullets: [
        "Authors import nothing — the host object is the entire surface",
        "Commands bind keyboard shortcuts; open handlers claim file types",
        "Declarative UI lets a module paint panels without React",
      ],
      cta: [{ label: "The defineModule shape", href: "/docs/modules/writing-a-module", variant: "primary" }],
    },
    {
      kind: "steps",
      heading: "One format, two runtimes, one gateway",
      intro: "The entire architecture is three ideas.",
      steps: [
        {
          title: "One format",
          body: "Built-ins and community add-ons are byte-identical: the same defineModule call, the same host object, the same lifecycle.",
          color: "#0a84ff",
        },
        {
          title: "Two runtimes",
          body: "Trusted built-ins run in-process for speed; untrusted modules run isolated in a Web Worker. Same source, swapped in a single line.",
          color: "#ff9f0a",
        },
        {
          title: "One gateway",
          body: "Every host.* call is checked against the module's declared permissions before it can reach the system — for built-ins and community modules alike.",
          color: "#ff375f",
        },
      ],
    },
    {
      kind: "split",
      heading: "Add a feature without touching the app",
      media: "left",
      visual: "window",
      body: [
        "Because features are modules, extending Mutka never means editing core code or rebuilding the app. Drop an `index.js` into `~/.mutka/modules/<id>/` and it's discovered on launch — no App.tsx change, no glue.",
        "A module can claim every `.png` to render thumbnails, add a column of folder sizes, mount WebDAV as a sidebar place, or decode `.sqlite` files into browsable tables — all from outside the repo.",
      ],
    },
    {
      kind: "grid",
      heading: "What modules can build",
      intro: "The core stays small so the interesting ideas can live in modules.",
      items: [
        { title: "SQLite browser", body: "Claims every .sqlite file and renders its tables and rows in the pane.", badge: "SQL", color: "#0a84ff" },
        { title: "Cloud mounts", body: "Mounts WebDAV, S3 or Nextcloud as a Place in the sidebar — a virtual filesystem.", badge: "DAV", color: "#5ac8fa" },
        { title: "Live thumbnails", body: "Swaps native icons for image previews, waveform strips or EXIF badges.", badge: "IMG", color: "#ff375f" },
        { title: "Status-bar stats", body: "Computes folder sizes, duplicates or git status into the status bar.", badge: "∑", color: "#ff9f0a" },
      ],
    },
    {
      kind: "faq",
      heading: "Frequently asked",
      items: [
        {
          q: "Do I have to fork Mutka to add a feature?",
          a: "No. A module is a standalone file that imports nothing from the core. You write it outside the repo and drop it into ~/.mutka/modules/ — the app discovers and registers it on launch.",
        },
        {
          q: "Are built-in features really written the same way as community modules?",
          a: "Yes. Copy-paste, navigation, tabs and file operations all use the same defineModule shape and the same host object a community author uses. There is no special internal API.",
        },
        {
          q: "What's the difference between a built-in and a community module?",
          a: "Only the runtime. Trusted built-ins run in-process; untrusted community modules run isolated in a Web Worker. The source format is identical and both are checked by the same permission gateway.",
        },
      ],
    },
    {
      kind: "cta",
      heading: "Write a module in one file",
      body: "No build step, no core imports, no glue. Just defineModule and a host object.",
      color: "#0a84ff",
      links: [
        { label: "Write your first module", href: "/docs/modules/writing-a-module", variant: "primary" },
        { label: "Browse the docs", href: "/docs", variant: "ghost" },
      ],
    },
  ],
};

const MANAGER: FeatureArticle = {
  slug: "extension-manager",
  label: "Extension manager",
  title: "Install modules in one click",
  description:
    "Browse community modules, review exactly what each one can access, and install it live — no restart. Enable, disable, update or remove any module from one panel.",
  hook: "Browse, review permissions, and install community modules live — no restart.",
  topics: ["Catalog", "Install review", "Live lifecycle"],
  accent: "#bf5af2",
  badge: "⊕",
  datePublished: "2026-06-27",
  dateModified: "2026-06-27",
  related: ["safety", "modular-architecture", "ai-built-modules"],
  sections: [
    {
      kind: "hero",
      kicker: "live, no restart",
      title: "The extension manager",
      subtitle:
        "Mutka has a built-in panel for discovering, installing and managing modules. Every change — install, enable, disable, uninstall — takes effect immediately, with no restart and no config files to edit by hand.",
      badges: ["Browse the catalog", "Permission review", "One-click install"],
      cta: [
        { label: "Publishing a module", href: "/docs/modules/publishing-a-module", variant: "primary" },
        { label: "See all features", href: "/features", variant: "ghost" },
      ],
    },
    {
      kind: "prose",
      heading: "Everything you install, in one place",
      lede: true,
      body: [
        "The Modules overlay lists every module you have — built-in and community — with a live toggle for each. Disable one and its worker is torn down on the spot; re-enable it and it spins back up. Nothing requires relaunching the app.",
        "New modules come from the community catalog. Browse it, pick one, and Mutka downloads and validates it in a throwaway worker before anything touches your disk.",
      ],
    },
    {
      kind: "split",
      heading: "Review permissions before you trust it",
      media: "right",
      visual: "manager",
      body: [
        "Installing isn't blind. Before a module is written to disk, Mutka shows an install review: the module's identity, what it does, and the full list of permissions it requests — with the dangerous ones flagged.",
        "You decide with the facts in front of you. The same permissions you approve here are the only ones the gateway will ever honour for that module.",
      ],
      bullets: [
        "Full permission list, dangerous ones highlighted",
        "Validated in an isolated worker before install",
        "Approve, then it's written to ~/.mutka/modules/",
      ],
      cta: [{ label: "How permissions work", href: "/docs/modules/permissions", variant: "primary" }],
    },
    {
      kind: "steps",
      heading: "From catalog to running, in four steps",
      steps: [
        { title: "Browse", body: "Open the Modules panel and explore the community catalog of available modules.", color: "#bf5af2" },
        { title: "Review", body: "Mutka downloads and validates the module, then shows its permissions for your approval.", color: "#0a84ff" },
        { title: "Install", body: "On approval the module is written to ~/.mutka/modules/ and registered live.", color: "#30d158" },
        { title: "Manage", body: "Enable, disable, update or uninstall any module later — every change is instant.", color: "#ff9f0a" },
      ],
    },
    {
      kind: "grid",
      heading: "Full lifecycle control",
      intro: "The manager owns a module from install to removal.",
      items: [
        { title: "Enable / disable", body: "Toggle any module on or off live; disabling terminates its worker immediately.", badge: "⏻", color: "#30d158" },
        { title: "Install from catalog", body: "Download, validate and register a community module in one approved click.", badge: "⊕", color: "#bf5af2" },
        { title: "Uninstall", body: "Remove a module and its files from disk; the app updates without a restart.", badge: "⊖", color: "#ff375f" },
        { title: "Persisted state", body: "Your enabled set and install metadata are saved, so your setup survives relaunches.", badge: "⤓", color: "#0a84ff" },
      ],
    },
    {
      kind: "callout",
      title: "Nothing runs that you didn't approve",
      body: "A module is only registered after you've seen its permissions and accepted them. Until then it lives in a throwaway validation worker that can't touch your system.",
      color: "#bf5af2",
    },
    {
      kind: "faq",
      heading: "Frequently asked",
      items: [
        {
          q: "Do I need to restart Mutka after installing a module?",
          a: "No. Installing, enabling, disabling and uninstalling all take effect live. The manager spins workers up and tears them down on the fly.",
        },
        {
          q: "Where do community modules come from?",
          a: "From the community catalog. Mutka resolves and validates each module in an isolated worker before showing you the install review and writing anything to disk.",
        },
        {
          q: "Can I see what a module can access before installing?",
          a: "Yes — that's the whole point of the install review. It lists every permission the module requests and flags the dangerous ones so you can decide with full information.",
        },
        {
          q: "Where are installed modules stored?",
          a: "Each module lives in ~/.mutka/modules/<id>/index.js, and your enabled/disabled state plus install metadata are kept in ~/.mutka/config.json.",
        },
      ],
    },
    {
      kind: "cta",
      heading: "Ready to publish your own?",
      body: "Build a module, then share it with the community catalog.",
      color: "#bf5af2",
      links: [
        { label: "Publishing a module", href: "/docs/modules/publishing-a-module", variant: "primary" },
        { label: "Write a module", href: "/docs/modules/writing-a-module", variant: "ghost" },
      ],
    },
  ],
};

const AI: FeatureArticle = {
  slug: "ai-built-modules",
  label: "AI-built modules",
  title: "Modules designed to be built by AI",
  description:
    "A Mutka module is one self-contained file with no imports, no build step and explicit permissions — the perfect shape for a language model to generate. Describe what you want, drop the file in, plug it in.",
  hook: "One file, zero imports, explicit permissions — the perfect shape for an LLM to generate.",
  topics: ["LLM-friendly", "No build step", "Prompt to module"],
  accent: "#ff9f0a",
  badge: "✦",
  datePublished: "2026-06-27",
  dateModified: "2026-06-27",
  related: ["modular-architecture", "safety", "extension-manager"],
  sections: [
    {
      kind: "hero",
      kicker: "built for the AI era",
      title: "Modules built by AI",
      subtitle:
        "Because a module is one self-contained file with a tiny declared surface — no imports, no build step, no hidden globals — it's the ideal thing for a language model to generate. Describe a feature, get a working module, plug it in.",
      badges: ["One file", "Zero core imports", "Explicit permissions"],
      cta: [
        { label: "Write a module", href: "/docs/modules/writing-a-module", variant: "primary" },
        { label: "See all features", href: "/features", variant: "ghost" },
      ],
    },
    {
      kind: "prose",
      heading: "The shape an LLM loves",
      lede: true,
      body: [
        "Generating code for a sprawling plugin API is hard: an AI has to know dozens of imports, a build configuration and the hidden conventions of a codebase. Mutka removes all of that.",
        "A module is a single ESM file that exports `defineModule({ … })`. It imports nothing, needs no compilation, and reaches the system only through one `host` object. There is barely any surface for the model to get wrong.",
      ],
    },
    {
      kind: "split",
      heading: "Describe it, generate it, drop it in",
      media: "right",
      visual: "ai",
      body: [
        "Tell your AI assistant what you want — \"add a word-count column for .txt files\" — and it can produce a complete, working module in one file. No scaffolding, no wiring, no glue.",
        "Save the result to `~/.mutka/modules/`, enable it in the manager, and it runs. Because permissions are explicit, the generated module can't quietly overreach beyond what it declared.",
      ],
      bullets: [
        "One file to generate — nothing to scaffold",
        "Explicit permissions keep generated code honest",
        "The same shape powers every built-in feature",
      ],
      cta: [{ label: "Writing a module", href: "/docs/modules/writing-a-module", variant: "primary" }],
    },
    {
      kind: "code",
      heading: "A prompt becomes a module",
      caption: "\"Write a Mutka module that adds a Word count column for .txt files.\"",
      lines: [
        [
          { t: "export default", cls: "tok-key" },
          { t: " defineModule", cls: "tok-fn" },
          { t: "({", cls: "tok-punc" },
        ],
        [
          { t: "  id", cls: "tok-prop" },
          { t: ": ", cls: "tok-punc" },
          { t: '"ai.wordcount"', cls: "tok-str" },
          { t: ",", cls: "tok-punc" },
        ],
        [
          { t: "  permissions", cls: "tok-prop" },
          { t: ": [", cls: "tok-punc" },
          { t: '"fs:read"', cls: "tok-str" },
          { t: "],", cls: "tok-punc" },
        ],
        [
          { t: "  setup", cls: "tok-fn" },
          { t: "(host) {", cls: "tok-punc" },
        ],
        [
          { t: "    host.columns.", cls: "tok-punc" },
          { t: "add", cls: "tok-fn" },
          { t: "(", cls: "tok-punc" },
          { t: '"Words"', cls: "tok-str" },
          { t: ", readWords);", cls: "tok-punc" },
        ],
        [{ t: "  }", cls: "tok-punc" }],
        [{ t: "});", cls: "tok-punc" }],
      ],
    },
    {
      kind: "grid",
      heading: "Why generated modules just work",
      items: [
        { title: "Nothing to wire up", body: "One file, zero core imports. The model writes the whole module — there's no surrounding project to misconfigure.", badge: "1", color: "#ff9f0a" },
        { title: "Can't overreach", body: "Permissions are explicit and gated, so even an over-eager generation is held to what it declared.", badge: "2", color: "#30d158" },
        { title: "Identical to built-ins", body: "The same shape powers copy-paste and navigation, so the model is targeting a proven, well-documented API.", badge: "3", color: "#0a84ff" },
      ],
    },
    {
      kind: "faq",
      heading: "Frequently asked",
      items: [
        {
          q: "Why are Mutka modules well suited to AI generation?",
          a: "A module is a single file with no imports, no build step and a tiny declared surface — the host object. That minimal, self-contained shape is exactly what language models generate most reliably.",
        },
        {
          q: "Is it safe to run a module an AI wrote?",
          a: "The same permission sandbox applies. A generated module only gets the capabilities it declared, you review them before installing, and untrusted modules run isolated in a Web Worker.",
        },
        {
          q: "Do I need a build step to run a generated module?",
          a: "No. Modules are plain ESM files. Save the generated file to ~/.mutka/modules/ and enable it in the manager — there's nothing to compile.",
        },
      ],
    },
    {
      kind: "cta",
      heading: "Generate your first module",
      body: "Open the writing guide, hand it to your AI, and plug the result in.",
      color: "#ff9f0a",
      links: [
        { label: "Write a module", href: "/docs/modules/writing-a-module", variant: "primary" },
        { label: "Browse the docs", href: "/docs", variant: "ghost" },
      ],
    },
  ],
};

/** All feature articles, in the order they appear on the hub. */
export const FEATURE_ARTICLES: FeatureArticle[] = [
  MODULAR,
  SAFETY,
  MANAGER,
  AI,
];

export function getArticle(slug: string): FeatureArticle | undefined {
  return FEATURE_ARTICLES.find((a) => a.slug === slug);
}
