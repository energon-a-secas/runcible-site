---
name: Runcible
description: A learning book that grades you, and says what you can now do
register: product
colors: { ink: "#040714", paper: "#f9f9f9", paper-dim: "#cacaca", accent: "#e11d48", accent-bright: "#f43f5e", on-accent: "#fffbfb", danger: "#dc2626" }
typography:
  display: { fontFamily: "Avenir Next, -apple-system, Segoe UI, sans-serif", fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.25 }
  title: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.3 }
  body: { fontSize: "1rem", fontWeight: 400, lineHeight: 1.65 }
  label: { fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em" }
rounded: { sm: "6px", md: "10px", lg: "15px" }
spacing: { sm: "8px", md: "16px", lg: "24px", section: "56px" }
components:
  button-primary: { backgroundColor: "{colors.accent}", textColor: "{colors.on-accent}", rounded: "{rounded.sm}", height: "44px" }
  keycap: { textColor: "{colors.paper-dim}", rounded: "{rounded.sm}", size: "28px" }
---

# Design System: Runcible

Long form: `docs/DESIGN-BOOK.md`: the screenshots, the rail, the facing page,
the string lists. This is what a new screen is checked against.

## Overview

Register: product. The design serves the reading. Twenty minutes after dark,
phone on a train or laptop on a kitchen table, so the ground is the fleet's near
black. What is imitated is a book: a reading column, a rail of contents, a
bookmark, a facing page for the drill. No cards, no dashboard, no bars.

## Colors

Strategy: restrained. The fleet's CDN `base.css` owns every neutral;
`css/style.css` declares four literals and derives the rest with `color-mix`.
Accent `#e11d48` carries under 10% of any screen: the primary button, the
bookmark, the current rung, the filled hairline, the tick on a right answer.
`--danger` is a second red for destructive actions, so "reset progress" never
reads as the primary one. `on-accent` is white mixed 2% toward the accent in
oklab, 4.57:1 on the fill.

## Typography

One family, the fleet's `--font`. Six steps, ratio about 1.2, `--text-xs`
0.75rem to `--text-2xl` 1.5rem, weight doing the rest: chapter title 2xl/600,
rung title xl/600, page title lg/600, body base/400 at 1.65 in
`--text-secondary`, notes sm in `--text-muted`. Measure caps at 66ch.

## Elevation

Flat. Depth is tonal: `--surface-1` and `--surface-2` at 3% and 6% white,
borders 7% to 22% white; the shadow tokens are the header's, the toast's and the
modal's. No card shadow, no hover lift on anything but a link, no glass.

## Components

- **Buttons** 44px (36px small), radius `sm`, one primary per view.
- **Option rows** are full width `[keycap] [label]` at 44px. The keycap is a
  28px monospace box on `--surface-2` showing 1 to 9, the label never carries a
  number prefix, and all-digit options make the label the cap.
- **Answer state is shape, not two reds.** The right row fills accent at 22% and
  ticks its cap, the picked wrong row strikes its label, the rest fall to 0.34.
  `--danger` never appears inside a drill.
- **The feedback panel** is at most three lines in one live region: what you
  picked, struck; the answer, with several accepted readings named as a list
  ("にほん, or にっぽん"); one sentence of why. Nothing to say stops at line two.
- **The three magic devices**: the bookmark ribbon hanging into the rung you
  stopped on, the rule echo washing the prose page a wrong answer belongs to,
  the margin tick beside a drill already passed.
- **Motion** is `--ease-out` `cubic-bezier(0.22, 1, 0.36, 1)`, never
  `--ease-snap`; opacity and transform only. Chapter change 180ms, facing page
  220ms, feedback 150ms, press 60ms to 0.98. The bookmark is a state: no motion.

## Do's and Don'ts

- Do let a page be as tall as its content: Today stacks its spread on a portrait
  tablet rather than centring two short columns in it.
- Do put every learner-facing string in `js/i18n.js` or `strings.js` as
  `{ en, es }`. A joining word is language.
- Don't add a card, a side stripe, a bar or a gradient: evidence is a sentence
  and a 2px hairline. No em dashes anywhere, and no sales adjectives in copy.
