# Macows Explorer — Visual Style Guide

## Design language: macOS 26 Liquid Glass

The UI must feel **indistinguishable from a native macOS 26 app**.
No generic web-app chrome. No flat, opaque surfaces.
Every surface that could be a Liquid Glass layer should be one.

---

## The Liquid Glass recipe

Liquid Glass is a combination of four CSS properties:

```css
.glass-surface {
  /* 1. Semi-transparent tint */
  background: rgba(255, 255, 255, 0.72);

  /* 2. Heavy blur + saturation boost = vibrancy */
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);

  /* 3. Rim light — the bright border that makes it look 3D */
  border: 1px solid rgba(255, 255, 255, 0.55);

  /* 4. Inner highlight + outer shadow */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.65),   /* top inner glow */
    0 8px 32px rgba(0, 0, 0, 0.15);              /* drop shadow */
}
```

In dark mode, the tint shifts to dark:

```css
[data-theme="dark"] .glass-surface {
  background: rgba(30, 30, 35, 0.78);
  border-color: rgba(255, 255, 255, 0.12);
}
```

---

## CSS design tokens (all in `styles/tokens.css`)

All values must be accessed via CSS variables. Never hardcode.

### Surfaces (light mode)

```css
--glass-heavy:   rgba(255, 255, 255, 0.78);   /* toolbar, status bar */
--glass-mid:     rgba(255, 255, 255, 0.55);   /* sidebar, panel headers */
--glass-light:   rgba(255, 255, 255, 0.30);   /* hover states */
--glass-subtle:  rgba(255, 255, 255, 0.12);   /* very subtle overlays */
```

### Surfaces (dark mode) — `[data-theme="dark"]`

```css
--glass-heavy:   rgba(28, 28, 32, 0.82);
--glass-mid:     rgba(40, 40, 46, 0.70);
--glass-light:   rgba(58, 58, 66, 0.45);
--glass-subtle:  rgba(255, 255, 255, 0.06);
```

### Borders (rim lights)

```css
--rim-bright:  rgba(255, 255, 255, 0.70);   /* top edge highlight */
--rim-mid:     rgba(255, 255, 255, 0.40);   /* general borders */
--rim-dark:    rgba(0,   0,   0,   0.06);   /* subtle dividers */
```

### Text

```css
--text:        rgba(0, 0, 0, 0.85);    /* primary text */
--text-mid:    rgba(0, 0, 0, 0.55);    /* secondary text (dates, sizes) */
--text-subtle: rgba(0, 0, 0, 0.36);    /* placeholder, disabled */
```

Dark mode text:

```css
[data-theme="dark"] {
  --text:        rgba(255, 255, 255, 0.90);
  --text-mid:    rgba(255, 255, 255, 0.55);
  --text-subtle: rgba(255, 255, 255, 0.30);
}
```

### Accent (macOS blue)

```css
--accent:       #007AFF;
--accent-light: rgba(0, 122, 255, 0.15);
--accent-hover: rgba(0, 122, 255, 0.22);
--accent-sel:   rgba(0, 122, 255, 0.28);
```

The accent color follows the macOS system accent. For now it is fixed at `#007AFF` (blue).
**Open question**: Should we read the system accent color via Tauri and expose it as a variable?

### Blur levels

```css
--blur-heavy:  blur(48px) saturate(200%);   /* context menus, sheets */
--blur-mid:    blur(24px) saturate(180%);   /* toolbar, sidebar */
--blur-light:  blur(12px) saturate(160%);   /* row hovers, subtle surfaces */
```

### Shadows

```css
--shadow-float:  0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08);
--shadow-panel:  0 2px 12px rgba(0,0,0,0.10);
--shadow-inner:  inset 0 1px 0 rgba(255,255,255,0.65);
```

### Corner radii

```css
--r-sm:  6px;    /* rows, small buttons */
--r-md:  10px;   /* breadcrumb, input fields */
--r-lg:  14px;   /* panels, cards */
--r-xl:  18px;   /* context menus, sheets */
```

---

## Typography

Font: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif`
Always use `-apple-system` so the correct SF Pro variant is used automatically.

| Use                           | Size   | Weight                                  |
| ----------------------------- | ------ | --------------------------------------- |
| Body text (file names)        | 13px   | 400                                     |
| Column headers                | 11px   | 600 + uppercase + letter-spacing 0.02em |
| Secondary text (dates, sizes) | 11.5px | 400                                     |
| Breadcrumb                    | 12px   | 500                                     |
| Status bar                    | 11px   | 400                                     |

Enable antialiasing on body: `-webkit-font-smoothing: antialiased`

---

## Component-by-component style rules

### Toolbar

- Background: `var(--glass-heavy)` + `var(--blur-mid)`
- Bottom border: `1px solid var(--rim-dark)`
- Inner top highlight: `box-shadow: var(--shadow-inner)`
- Left padding: `80px` — safe zone for macOS traffic-light buttons (red/yellow/green)
- Height: `50px` minimum

### Toolbar buttons

- Default: transparent background, transparent border
- Hover: `var(--glass-mid)` background + `var(--rim-mid)` border + light blur
- Press: `var(--glass-light)` + `var(--rim-bright)` border
- Disabled: `opacity: 0.30`
- Never show a focus ring on mouse click (only on keyboard Tab)

### One glass capsule for ALL controls

Every toolbar control — single buttons (`.toolbar-btn`), the back|forward segmented
control (`.toolbar-segment`), and the breadcrumb (`#breadcrumb`) — wears the **same**
Liquid Glass capsule so the toolbar reads as one coherent material. The capsule is the
`--ctl-*` token set:

```css
background: var(--ctl-bg);             /* FLAT translucent fill — NO vertical gradient */
backdrop-filter: var(--ctl-blur);      /* blur(24px) saturate(150%) */
border: none;                          /* no rim — borders read as dated chrome */
border-radius: var(--r-lg);            /* generously rounded, not square */
box-shadow: var(--ctl-shadow);         /* one soft drop shadow for depth (no specular) */
```

No vertical gradient and no inset specular highlight — those read as a 2008-era gloss, not
glass. Depth is one soft shadow. Hover → `--ctl-bg-hover` (brighten). Active →
`--ctl-bg-active` (press-in). The segmented control is the same capsule with two
`.seg-btn`s joined by a `var(--seg-divider)` rule.

### Why the glass is actually visible (vibrancy reveal)

On macOS the window is `transparent: true` and `lib.rs` applies a native
`NSVisualEffectMaterial::Sidebar`. For that real blurred material to show, the `#app`
shell must NOT paint over it. `main.tsx` sets `data-vibrancy="on"` on macOS, and
`base.css` then makes `#app` transparent — so the translucent toolbar/sidebar blur the
**real desktop material**, not a flat color. The file list keeps a near-opaque background
(readability), exactly like real Finder: opaque content, translucent chrome.

### Breadcrumb

- Background: `var(--glass-mid)` + `var(--blur-light)`
- Border: `1px solid var(--rim-mid)`
- Radius: `var(--r-md)`
- Segment links: `var(--accent)` color, hover gets `var(--accent-light)` bg

### File rows — Finder **list view** style

The main file list mimics Finder's list view, NOT the source-list style used by the
sidebar. Rows are full-bleed (edge to edge, no margin, no radius) so selection reads as
a continuous bar.

- Zebra striping: every other row tinted with `var(--row-stripe)` (Finder's "% 2")
- Hover (unselected only): `var(--row-hover)`
- Selected (focused): solid `var(--row-selected)` bar + `var(--row-selected-text)` text —
  no translucent fill, no ring. This is the Finder list-view selection.
- Cut items: `opacity: 0.38`
- No `border-radius`, no `margin` — full-width rows

> The **sidebar** (`Places`) keeps the *source-list* selection: rounded `var(--accent-sel)`
> translucent pill. Two different selection idioms, exactly like real Finder.

### Context menu — most important Liquid Glass surface

- Background: multi-angle gradient glass (see the ContextMenu component CSS)
- Blur: `var(--blur-heavy)` — maximum vibrancy
- Bright rim border: `1px solid var(--rim-bright)`
- Corner radius: `var(--r-xl)` — macOS menus have large radii
- Item hover: gradient blue from `#007AFF` to `#005FD7` with blue glow shadow
- Separators: fading gradient line (transparent → color → transparent)

### Sidebar panels (planned)

- Background: `var(--glass-mid)` + `var(--blur-mid)`
- Tab strip: icons only, 36px wide, with selected indicator
- Selected tab: `var(--accent)` tinted icon, subtle blue pill background

### Status bar

- Height: 24px
- Background: `var(--glass-heavy)` + `var(--blur-light)`
- Top border: `1px solid var(--rim-dark)`
- Bottom inner glow: `box-shadow: inset 0 -1px 0 var(--rim-bright)`

---

## Dark mode implementation

The theme is applied via `data-theme` attribute on `<html>`.

```css
/* Default = light */
:root {
  --glass-heavy: rgba(255, 255, 255, 0.78);
  --text: rgba(0, 0, 0, 0.85);
  /* ... */
}

/* Dark override */
[data-theme="dark"] {
  --glass-heavy: rgba(28, 28, 32, 0.82);
  --text: rgba(255, 255, 255, 0.90);
  /* ... */
}
```

`ThemeManager.ts` sets `document.documentElement.setAttribute("data-theme", resolved)`.
No JavaScript color logic — all via CSS variables.

---

## What to NEVER do

| Forbidden                               | Why                                     |
| --------------------------------------- | --------------------------------------- |
| `style={{ color: "#333" }}` inline      | Can't adapt to dark mode                |
| `background: white` in CSS              | Invisible in dark mode                  |
| `border: 1px solid #ddd`                | Should be `var(--rim-dark)`             |
| `box-shadow: none` on glass surfaces    | Loses the Liquid Glass 3D feel          |
| `border-radius: 0` on floating elements | Violates macOS HIG                      |
| `font-family: Arial` or any web font    | Must use SF Pro via `-apple-system`     |
| Opacity < 0.30 for disabled states      | Below macOS HIG accessibility threshold |
| Hard-coded pixel widths for text        | Use `ch` units or let text flow         |
