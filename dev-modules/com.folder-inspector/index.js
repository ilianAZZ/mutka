// EXAMPLE COMMUNITY MODULE — untrusted, runs ISOLATED in a Web Worker.
//
// Shows the DECLARATIVE UI surface in action: this module ships NO React, no
// HTML, no CSS. It describes its UI as a serializable UINode tree and the host
// renders it natively. It contributes:
//   • a right-pane panel that reflects the current selection (host.ui.render)
//   • a JSON-Schema form whose submit opens a modal (host.ui.modal)
//   • a bottom status-bar item with a popover (host.statusbar + host.ui.render)
//   • a reaction to on-disk changes (the whitelisted "directory:changed" event)
//   • a settings section (also a declarative surface)
//
// Everything arrives through `host`, gated by the permissions declared below.
export default {
  id: "com.folder-inspector",
  name: "Folder Inspector",
  version: "1.0.0",
  icon: "data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2024%2024'%3E%3Crect%20width%3D'24'%20height%3D'24'%20rx%3D'6'%20fill%3D'%235b6ee1'%2F%3E%3Ccircle%20cx%3D'11'%20cy%3D'11'%20r%3D'4'%20stroke%3D'%23fff'%20stroke-width%3D'1.6'%20fill%3D'none'%2F%3E%3Cpath%20d%3D'M14%2014l3%203'%20stroke%3D'%23fff'%20stroke-width%3D'1.6'%20stroke-linecap%3D'round'%2F%3E%3C%2Fsvg%3E",
  author: { name: "Ilian", github: "ilianAZZ" },
  tags: ["ui","inspector","declarative"],
  description: "A declarative right-pane inspector, status widget and form — no React.",
  permissions: ["ui"],
  panels: [
    { id: "inspector", title: "Inspector", icon: "info", side: "right", defaultWidth: 260 },
  ],
  settingsSections: [
    { id: "about", title: "Folder Inspector" },
  ],
  setup(host) {
    let selected = [];

    // Build the panel's UINode tree from the current selection.
    function panelTree() {
      const rows = selected.length
        ? selected.slice(0, 50).map((it) => ({
            type: "row",
            label: it.name,
            icon: it.isDir ? "folder" : "file",
            value: it.isDir ? "folder" : `${it.size} B`,
          }))
        : [{ type: "text", text: "Select files to inspect them.", muted: true, size: "sm" }];

      return {
        type: "vstack",
        gap: 8,
        children: [
          { type: "text", text: `${selected.length} selected`, weight: "bold" },
          { type: "divider" },
          ...rows,
          { type: "divider" },
          {
            type: "form",
            action: "greet",
            submitLabel: "Show note",
            schema: {
              type: "object",
              required: ["note"],
              properties: {
                note: { type: "string", title: "Note", description: "Shown in a modal." },
                shout: { type: "boolean", title: "Uppercase", default: false },
              },
            },
          },
        ],
      };
    }

    function render() {
      host.ui.render("inspector", panelTree());
      // The status-bar popover reuses a second surface.
      host.ui.render("statuspop", panelTree());
      host.statusbar.set({
        id: "count",
        icon: "info",
        text: `${selected.length}`,
        tooltip: "Selected items — click to inspect",
        side: "right",
        onClick: { popover: "statuspop" },
      });
    }

    host.events.on("app:ready", render);

    host.events.on("selection:changed", (p) => {
      selected = (p && p.items) || [];
      render();
    });

    // React to on-disk changes in the directory currently in view.
    host.events.on("directory:changed", () => render());

    // The form's submit arrives here with the collected values object.
    host.onUIEvent("greet", (values) => {
      const note = String((values && values.note) || "");
      host.ui.modal({
        type: "vstack",
        gap: 12,
        children: [
          { type: "text", text: "Note", weight: "bold", size: "lg" },
          { type: "text", text: values.shout ? note.toUpperCase() : note },
          { type: "button", label: "Close", action: "dismiss", variant: "primary" },
        ],
      });
    });

    host.onUIEvent("dismiss", () => host.ui.modal(null));

    // The settings section is just another surface.
    host.ui.render("about", {
      type: "vstack",
      gap: 6,
      children: [
        { type: "text", text: "Folder Inspector renders entirely from a UINode tree.", size: "sm", muted: true },
        { type: "text", text: "It ships no React — the host draws every widget natively.", size: "sm", muted: true },
      ],
    });
  },
};
