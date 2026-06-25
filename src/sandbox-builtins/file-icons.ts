import { defineModule } from "../core/sandbox/defineModule";

// EXAMPLE: a module shipping its OWN icon for a file type.
//
// By default every file shows its native macOS icon (the one Finder uses). A
// module can override specific extensions with a custom image via `fileIcons`.
// The image is a base64 data-URI — the host renders it through <img src> only,
// never innerHTML, so even an SVG can't execute script. This is the safe,
// community-first way to brand a file type: an author "uploads" their logo as
// a data-URI and the UI knows to display it.
//
// Here we override .pdf with a small custom badge. Remove this module and .pdf
// falls straight back to the native macOS PDF icon — no other change needed.

const PDF_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIj48cGF0aCBkPSJNOCAyaDExbDcgN3YyMWEyIDIgMCAwIDEtMiAySDhhMiAyIDAgMCAxLTItMlY0YTIgMiAwIDAgMSAyLTJ6IiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9IiNjYmQwZDYiIHN0cm9rZS13aWR0aD0iMSIvPjxwYXRoIGQ9Ik0xOSAybDcgN2gtN3oiIGZpbGw9IiNjYmQwZDYiLz48cmVjdCB4PSI1IiB5PSIxNy41IiB3aWR0aD0iMjIiIGhlaWdodD0iOSIgcng9IjIiIGZpbGw9IiNlMjQzM2IiLz48dGV4dCB4PSIxNiIgeT0iMjQuMyIgZm9udC1mYW1pbHk9IkhlbHZldGljYSxBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjYuNiIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+UERGPC90ZXh0Pjwvc3ZnPgo=";

export default defineModule({
  id: "core.file-icons",
  name: "File Icons",
  version: "1.0.0",
  description: "Example: custom icon for .pdf (everything else uses the native macOS icon).",
  fileIcons: [{ extensions: ["pdf"], image: PDF_ICON }],
});
