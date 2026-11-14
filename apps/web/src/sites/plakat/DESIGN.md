---
name: Зейнара — Саломатлик плакати
description: A clinic corridor's numbered health poster in three printing inks on matte paper; the order form is its step 1.
colors:
  ultra: "#2443a8"
  ultra-deep: "#182f7d"
  ochre: "#f0b429"
  ochre-press: "#f5c24a"
  ochre-deep: "#d99a0b"
  ink: "#141414"
  ink-2: "#262626"
  muted: "#4a4a4a"
  rule-grey: "#8d8d86"
  sheet: "#fafaf7"
  field: "#ffffff"
  on-ultra: "#e4e9ff"
  screen: "rgba(255, 255, 255, 0.11)"
  danger: "#b42318"
typography:
  display:
    fontFamily: "Fira Sans Extra Condensed, Poster Fallback, Poster Fallback Wide, sans-serif"
    fontSize: "clamp(1.85rem, 9.4vw, 2.6rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0.005em"
  headline:
    fontFamily: "Fira Sans Extra Condensed, Poster Fallback, Poster Fallback Wide, sans-serif"
    fontSize: "clamp(2rem, 9vw, 3.4rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "0.005em"
  title:
    fontFamily: "Fira Sans Extra Condensed, Poster Fallback, Poster Fallback Wide, sans-serif"
    fontSize: "1.4rem"
    fontWeight: 800
    lineHeight: 1.05
  quote:
    fontFamily: "Fira Sans Extra Condensed, Poster Fallback, Poster Fallback Wide, sans-serif"
    fontSize: "clamp(1.55rem, 6.5vw, 2.4rem)"
    fontWeight: 800
    lineHeight: 1.08
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif"
    fontSize: "1.08rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Fira Sans Extra Condensed, Poster Fallback, Poster Fallback Wide, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.2
  small:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  square: "0"
  round: "999px"
spacing:
  gutter: "1rem"
  gutter-wide: "1.5rem"
  container: "72rem"
  section: "3.25rem"
  section-wide: "5rem"
  band: "2.75rem"
  row: "1.05rem"
components:
  button-order:
    backgroundColor: "{colors.ochre}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.square}"
    padding: "0.5rem 0.9rem"
    height: "3.75rem"
  button-order-hover:
    backgroundColor: "{colors.ochre-press}"
    textColor: "{colors.ink}"
  button-call:
    backgroundColor: "transparent"
    textColor: "{colors.ochre}"
    rounded: "{rounded.round}"
    height: "2.6rem"
  input-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
  step-panel:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0.95rem 0.9rem 0.6rem"
  roundel-ochre:
    backgroundColor: "{colors.ochre}"
    textColor: "{colors.ink}"
    rounded: "{rounded.round}"
    size: "2.2rem"
  roundel-paper:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ultra-deep}"
    rounded: "{rounded.round}"
    size: "2.2rem"
  ochre-band:
    backgroundColor: "{colors.ochre}"
    textColor: "{colors.ink}"
    padding: "2.75rem 0"
  bottom-bar:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    padding: "0.6rem 0.75rem"
---

# Design System: Зейнара — Саломатлик плакати

Scope: the workers.dev test page only (`src/sites/plakat/`). The project root `DESIGN.md` records a different world (`src/sites/main`) and does not govern this one. Tokens live in `plakat.css`, which re-points the shared tokens so the shared order form takes this world's inks.

## Overview

**Creative North Star: "The Corridor Health Poster"**

The specialist's explanation, printed as the numbered health poster on a clinic corridor wall. Offset print in three inks on matte stock: an ultramarine field carrying a visible halftone dot screen, one ochre, black ink, and the unprinted paper. Everything reads as print: flat ink, square sheets, ruled rows, numbered roundels, single-stroke pictograms. The order form is not a card floating over a hero. It is the poster's step 1, a paper panel inside a double printed rule, and steps 2 and 3 follow as a ruled strip under it.

Density is poster-like: big condensed capitals for the few words that matter, then reading text in the phone's own sans at generous sizes for an older audience. Sections alternate ultramarine field, paper, and one ochre band, separated by colour and heavy ink rules rather than by cards or shadows.

**Key Characteristics:**
- Three inks plus paper; ultramarine fields always carry the halftone dot screen.
- Condensed 800-weight capitals for headlines, labels and the order button; the platform sans for reading.
- Square sheets and fully round roundels, nothing in between.
- Depth by printed rules (heavy ink borders, a double rule around step 1), never by drop shadows.
- Numbered roundels carry the story: 1 is the form, 2 and 3 what happens next.
- One authored motion: the box's halftone plate lifting away to the photograph.

## Colors

A three-ink print palette: ultramarine for fields and emphasis, ochre for the single action and highlights, black for type and rules, on warm unprinted paper.

### Primary
- **Poster Ultramarine** (ultra): the hero, the box section and the closing section are ultramarine fields with the dot screen; on paper it inks the second half of section headlines, pictogram strokes, figures on the ochre band, the lead customer quote and the caret. Focus on inputs shifts their border to it.
- **Deep Ultramarine** (ultra-deep): the footer field and the numbers in paper roundels.

### Secondary
- **Printer's Ochre** (ochre): the one action colour (the order button, the phones' bar order button, the sound overlay), step-1 roundel, emphasised words in headlines on ultramarine (`em`), the masthead mark and call ring, links on ultramarine, the figures band, the keyboard focus outline, text selection.
- **Pressed Ochre** (ochre-press): the order button's hover, focus and busy state.
- **Deep Ochre** (ochre-deep): the shared form's autofilled-number warning border.

### Neutral
- **Black Ink** (ink): all type on paper, every printed rule and border, roundel rims.
- **Soft Ink** (ink-2): reading text in the specialist's points.
- **Muted Ink** (muted): small print (the results disclaimer).
- **Rule Grey** (rule-grey): the shared form's default line token; on this page the fields override it with black ink.
- **Matte Paper** (sheet): page background, step panels, the bottom bar, the paper roundels and frames around photographs.
- **Field White** (field): the inside of input fields only, so they read as blanks on the paper.
- **Pale Ultramarine** (on-ultra): reading text and rules on ultramarine fields.
- **Dot Screen** (screen): the halftone dots on ultramarine, `radial-gradient(screen 1.1px, transparent 1.5px)` on a 7px grid.
- **Error Red** (danger): inherited from the shared form for field errors; not re-pointed.

### Named Rules
**The Three Inks Rule.** Ultramarine, ochre and black on paper. A fourth hue enters only as a functional state (the shared error red), never as decoration.

**The Screened Field Rule.** Every ultramarine field carries the 7px halftone dot screen; a flat blue field is a different world.

**The One Ochre Action Rule.** The filled ochre block with a black rule is the order action. Ochre elsewhere is highlight (words, roundel 1, the figures band, links), never a second filled button.

## Typography

**Display Font:** Fira Sans Extra Condensed 800 (self-hosted via @fontsource, Cyrillic incl. ў қ ғ ҳ), with metric-matched local fallbacks («Poster Fallback»: Arial Narrow / Roboto Condensed at 96%; «Poster Fallback Wide»: Arial / Roboto at 76%)
**Body Font:** the platform sans (Roboto on Android, SF on iPhone), not self-hosted, so the form is ready fast on slow networks.

**Character:** a condensed poster grotesque shouting a few words in capitals, over a quiet phone-native sans that does the reading.

### Hierarchy
- **Display** (800, clamp(1.85rem, 9.4vw, 2.6rem) on phones, clamp(3.4rem, 6vw, 5.25rem) from 640px, line-height 0.95, uppercase): the hero question only. Reserves two lines' height on phones so the arriving face never pushes the form down.
- **Headline** (800, clamp(2rem, 9vw, 3.4rem), 0.98, uppercase, max 22ch): section titles; second half in ultramarine on paper or ochre on ultramarine.
- **Title** (800, 1.35–1.4rem, ~1.0–1.05, uppercase): step-1 title, the specialist's point headings, the order button and bar label.
- **Quote** (800, clamp(1.55rem, 6.5vw, 2.4rem), 1.08, sentence case, ultramarine): the lead customer quote. The figures sentence on ochre is the same face at clamp(1.9rem, 8.5vw, 3.6rem), uppercase, figures in ultramarine with tabular numerals.
- **Body** (400, 1.02–1.15rem, 1.38–1.55): lead, explanations, quotes, certificate note; max 62ch on paper, 34–36rem on ultramarine.
- **Label** (700, 1rem, display face): the shared form's field labels. They render in the condensed face because the shared form marks them display; the direction contract assigned reading text to the phone sans, the build carries the condensed face here.
- **Small** (400, 1rem): privacy line, disclaimer, video captions, footer.

### Named Rules
**The 1rem Floor Rule.** No reading text below 1rem, including privacy lines, captions, small print and the footer. The audience is 40–65.

**The Capitals Are Ink Rule.** Uppercase belongs to the condensed face at 800. Reading text in the platform sans stays sentence case.

## Layout

A single 72rem column with 1rem gutters (1.5rem from 640px). Sections stack full-bleed: ultramarine hero, paper, ultramarine, ochre band, paper, ultramarine close, deep-ultramarine footer. Sections pad 3.25rem vertically on phones, 5rem from 640px; the ochre band 2.75rem.

Phone first. On a 390×844 phone the masthead, the two-line question, a one-line lead and the whole step-1 panel fit the first screen, with steps 2–3 entering below it; at 320×568 the step-1 title hides and the headline drops to 1.6rem so the button stays whole. From 1024px the hero becomes two columns (1.05fr / 0.95fr, 3.5rem gap), steps 2–3 move under the lead, and the specialist's points and the quote list run in two columns with a 3rem gap.

Lists are ruled rows, not tiles: a 3px ink rule on top, 1.5px ink rules between rows, ~1.05rem row padding, pictograms in a 2.6rem margin column. The customer videos scroll sideways with snap on phones (72% width each) and become a 3-column grid from 640px, 4 from 1024px. A fixed bottom bar on phones (hidden from 768px) leaves while any form is on screen, a field has focus, or the order is in.

## Elevation & Depth

Flat print. No drop shadows, no tonal or colour gradients; the halftone dot screen is the only gradient. Depth is printed: heavy black rules (3px) around the order button, the step panel, video frames and the ochre band; the step panel's double rule (a 3px ink border plus a 1.5px paper outline offset 3px) is the strongest frame on the page. The shared form's card shadows and rounded plastic are switched off on this page.

### Shadow Vocabulary
- **Field focus ring** (`box-shadow: 0 0 0 3px rgba(36, 67, 168, 0.28)`): the only box-shadow, a state ring on a focused input, not elevation.

### Named Rules
**The Printed Rule Rule.** Separation and emphasis come from ink rules and ink colour. If something needs to stand forward, give it a heavier rule or the double rule, never a shadow.

**The One Moment Rule.** One authored motion: the box's halftone print fades, scales to 1.04 and blurs away to the photograph (1.6s, cubic-bezier(0.16, 1, 0.3, 1)) once it is 45% in view. The bottom bar's 0.3s slide is the only other movement. Under reduced motion the plate is not shown.

## Shapes

Square or fully round, never in between. Sheets, panels, fields, buttons, frames and photographs have square corners (0); the shared form's rounded corners are flattened here. Round (999px) is reserved for the numbered roundels, the masthead's call ring and customer faces. Pictograms are single strokes (2.4 width), square caps and mitred joins, drawn as print in the ink of their panel.

## Components

### Buttons
- **Shape:** square (0), framed by a 3px black rule.
- **Order (primary):** ochre block, black condensed 800 uppercase label at 1.35rem, min-height 3.75rem; the shared button's slider knob and gradient body are hidden.
- **Hover / Focus / Busy:** pressed ochre fill; keyboard focus adds a 3px ochre outline offset 3px.
- **Call ring:** a 2.6rem ochre-outlined circle with the phone icon in the masthead; from 640px it widens to a pill showing the number in tabular numerals.

### Inputs / Fields
- **Style:** white field, black 2px border, square, 1.3rem text; the +998 prefix separated by a black rule.
- **Focus:** border turns ultramarine with the 3px ultramarine focus ring.
- **Error / Warning:** error red border from the shared form; an autofilled number gets a deep-ochre border on a pale ochre wash.

### Step Panel (signature)
Paper rectangle in the double printed rule, an ochre roundel «1» hung over its top-left edge, the condensed title beside it, the shared form inside with no card of its own. The same panel closes the page on the ultramarine close section.

### Numbered Roundels
2.2rem circles, 2.5px rim, condensed 800 numerals. Ochre with black rim for step 1; paper with deep-ultramarine numeral for steps 2–3 on ultramarine, which sit in a two-column strip with a pale-ultramarine rule on top and between.

### Ruled Lists
The specialist's points and the customer quotes: a heavy ink rule on top, hairline ink rules between rows, no boxes. Quote footers carry a round face (4rem lead, 3rem list) in a 2.5px ink rim on ochre.

### Printed Box
The real box photograph in a 3:4 frame (min(80vw, 22rem)) on ochre, framed by a 3px paper rule, with its one-ink halftone print laid over it until it lifts away.

### Video Frames
3:4 videos in a 3px ink frame on paper with a 2px-ruled caption below; the sound prompt is an ochre block with a black rule and a stroked speaker pictogram, centred on the video.

### Navigation
No menu. A masthead strip on the ultramarine field: «ЗЕЙНАРА» in ochre condensed 800, a pale-ultramarine tagline from 640px, the call ring at the right. On phones, the fixed bottom bar: a square ink-ruled call button and a full ochre order button on paper, under a 3px ink rule.

## Do's and Don'ts

### Do:
- **Do** set every ultramarine field with the 7px halftone dot screen.
- **Do** keep the order action a single ochre block with a 3px black rule and condensed uppercase label.
- **Do** frame the order form as a numbered step on paper inside the double printed rule.
- **Do** separate content with ink rules (3px heads, 1.5px between rows) instead of cards.
- **Do** keep every reading size at 1rem or more.
- **Do** keep corners either square (0) or fully round (999px).
- **Do** gate the one authored motion behind reduced-motion.

### Don't:
- **Don't** use drop shadows for depth; the only box-shadow is the field focus ring.
- **Don't** use tonal or colour gradients; the dot screen is the only gradient.
- **Don't** add a fourth decorative hue beyond ultramarine, ochre and black on paper.
- **Don't** use intermediate corner radii (rounded cards, pill buttons for the order action).
- **Don't** set reading paragraphs in the condensed display face or in capitals.
