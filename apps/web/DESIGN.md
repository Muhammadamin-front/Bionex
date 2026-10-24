---
name: Оромгоҳ даволаш маскани
description: A dasturxon laid for a guest — white porcelain and the light-blue paxta-guli tea-set pattern, for the Зейнара order page.
colors:
  piyola-blue: "#1d68b3"
  piyola-blue-deep: "#15528f"
  pattern-mid: "#5a9bd8"
  pattern-soft: "#8dbfeb"
  pattern-light: "#bfe0fa"
  navy-ink: "#0f2f4f"
  ink-soft: "#1c4268"
  muted-ink: "#355a80"
  placeholder-ink: "#4f6f92"
  navy-mark: "#12395f"
  on-blue: "#d6e8f8"
  sky-cloth: "#eaf4fc"
  cloth-shade: "#dcebf8"
  porcelain: "#ffffff"
  glaze-line: "#c4dcf1"
  button-top: "#3a8ad6"
  button-bottom: "#1a5ea3"
  error-red: "#b42318"
typography:
  display:
    fontFamily: "Nunito Variable, Nunito Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.05rem, 5vw, 2.9rem)"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Nunito Variable, Nunito Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.85rem, 4vw, 2.5rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Nunito Variable, Nunito Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.3
  body:
    fontFamily: "Nunito Variable, Nunito Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.625
  label:
    fontFamily: "Nunito Variable, Nunito Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  control: "1rem"
  form: "1.5rem"
  panel: "1.75rem"
  card: "2rem"
  tray: "2.25rem"
  round: "9999px"
spacing:
  gutter: "1rem"
  gutter-wide: "1.5rem"
  stack: "1.5rem"
  section: "4rem"
  section-wide: "6rem"
components:
  button-primary:
    backgroundColor: "{colors.button-bottom}"
    textColor: "{colors.porcelain}"
    rounded: "{rounded.control}"
    height: "4rem"
  button-pill:
    backgroundColor: "{colors.piyola-blue}"
    textColor: "{colors.porcelain}"
    rounded: "{rounded.round}"
    height: "3rem"
    padding: "0 1.25rem"
  button-pill-hover:
    backgroundColor: "{colors.piyola-blue-deep}"
  button-on-blue:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.piyola-blue-deep}"
    rounded: "{rounded.control}"
    height: "4rem"
  input-field:
    backgroundColor: "{colors.sky-cloth}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.control}"
    height: "4rem"
    padding: "0 1rem"
  input-field-focus:
    backgroundColor: "{colors.porcelain}"
  symptom-chip:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.control}"
    padding: "0.75rem 1rem"
  card-porcelain:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.card}"
    padding: "2.5rem"
  panel-blue:
    backgroundColor: "{colors.piyola-blue}"
    textColor: "{colors.on-blue}"
    rounded: "{rounded.panel}"
    padding: "1.5rem"
---

# Design System: Оромгоҳ даволаш маскани

Scope: this file describes the main site only (`src/sites/main/`); the partner build (`vite --mode t2`) keeps its own older green/yellow look and is not part of this system.

## Overview

**Creative North Star: "The Dasturxon for a Guest"**

The page is a tea table laid for someone respected: a pale sky cloth for the ground, white glazed porcelain for every surface that holds something, and the light-blue paxta-guli (cotton-boll) tea-set pattern every Uzbek home owns, used the way porcelain uses it — as rims, borders and bands, never as a wallpaper behind text. Navy is the ink; one glazed piyola blue carries the action. The whole palette stays inside light blue, by the owner's explicit choice.

Objects on the table give the page its shapes: the round lagan plate that carries the pack and the family photo, small round piyola medallions holding icons and step numbers, and the patnis — a tray with a patterned rim — that carries the order form. Density is calm and generous for readers aged 45–65 on phones: the root size is 112.5% (1rem = 18px), body text is never smaller than 1.125rem, and tap targets are 4rem tall.

Motion is spare and authored: the plate is set down once (a 1.2s exponential ease), a ticked symptom opens a cotton boll beside it, and the pack's printed heart beats six times when seen. Danger is said in words, in navy, not shouted in red.

**Key Characteristics:**
- Pale sky cloth ground, white porcelain surfaces, navy ink, one piyola blue for action.
- The paxta-guli pattern as rims, bands and plate rings only.
- Round objects (lagan, piyola) for media, icons and numbers; generously rounded trays and cards for content.
- One rounded type family, Nunito, at weights 500–900.
- Soft navy-tinted drop shadows that read as objects resting on cloth.

## Colors

A single light-blue family from cloth to navy ink, with one deeper glazed blue for action.

### Primary
- **Piyola Blue** (piyola-blue): the glaze of a tea bowl. Primary buttons, the accent word in the hero, the outer ring of plates, piyolas and trays, the "result" panel of the symptom check, stat figures and rotated-diamond bullets.
- **Deep Piyola Blue** (piyola-blue-deep): hover state of blue buttons; secondary emphasis in text (step numbers, site sub-name, footer links, fact values).

### Secondary
- **Pattern Mid Blue** (pattern-mid): the boll bracts and rim scallops in the paxta-guli art; never used for text.
- **Pattern Soft Blue** (pattern-soft): pattern threads, the inner plate ring, the hero accent underline stroke, the tray's inner hairline.
- **Pattern Light Blue** (pattern-light): text selection, the button's slider knob, list-mark fill on dark.

### Neutral
- **Navy Ink** (navy-ink): all headings and primary text.
- **Soft Ink** (ink-soft): long body paragraphs.
- **Muted Ink** (muted-ink): hints, captions, sources, review meta.
- **Navy Mark** (navy-mark): heavy marks and the "alarm" role — the system speaks danger in navy.
- **On-Blue** (on-blue): body text set on Piyola Blue panels.
- **Sky Cloth** (sky-cloth): page ground and resting input fill.
- **Cloth in Shade** (cloth-shade): the reviews band and alert backgrounds.
- **Porcelain** (porcelain): cards, trays, bands between rims, focused inputs.
- **Glaze Line** (glaze-line): hairlines, dividers, resting borders.
- **Error Red** (error-red): form validation errors only; a functional signal, not part of the world.

### Named Rules
**The Light Blue Only Rule.** Every UI colour lives in the blue family from Sky Cloth to Navy Ink. The only exceptions are the product's own photography (the red pack, the vessel illustration) and validation-error red on form fields.

**The One Glaze Rule.** Piyola Blue is the action colour. Pattern blues decorate; they never carry text or a button.

## Typography

**Display Font:** Nunito Variable (with a metric-matched Arial/Roboto fallback)
**Body Font:** Nunito Variable (same family)

**Character:** One rounded humanist family for everything — friendly, soft-cornered letterforms that match the porcelain, set heavy (800) for headings and medium (500) for reading, so hierarchy comes from size and weight, not from a second face.

### Hierarchy
- **Display** (800, 2.05rem phone → 2.9rem tablet → 2.55rem desktop three-column hero, line-height 1.12, -0.02em): the hero headline only, balanced; one accent word in Piyola Blue with a hand-drawn Pattern Soft underline.
- **Headline** (800, 1.85rem → 2.5rem, 1.15, -0.015em): section titles, balanced.
- **Title** (800, 1.25–1.95rem): sub-heads, card heads, disclosure summaries, the form's lead line.
- **Body** (500, 1.125rem, 1.625): reading text, max 60–62ch; lead sentences step up to 1.2–1.35rem bold.
- **Label** (500–700, 0.95–1.05rem): captions, sources, field hints; never below 0.95rem (17px).

### Named Rules
**The One Family Rule.** Nunito only. Contrast comes from weight (500 / 700 / 800 / 900) and size.

**The Spoken Numbers Rule.** Figures are set inside sentences in 900-weight Piyola Blue with tabular numerals, as a person would say them at the table — not as big isolated stat tiles.

## Layout

Single column on phones, stepping to two columns at `lg` (1024px) and a three-place table setting at `xl` (1280px) in the hero: words left, the lagan with the pack centre, the tray with the form right. On a phone the hero runs headline → plate (max 12.5rem) → three piyola cups in one row → tray form, so the offer fits the first screen.

Content sits in a centred container (72rem; the hero uses 80rem) with 1rem side padding, 1.5rem from `sm`. Sections breathe at 4rem vertical padding, 6rem from `sm`. Bands alternate between Sky Cloth and Porcelain; every Porcelain band is framed by a patterned rim strip top and bottom (the bottom one mirrored). On phones a fixed bottom order bar carries one full-width blue button and steps aside while a field has focus; the footer keeps 8rem bottom room to clear it.

## Elevation & Depth

Objects rest on cloth: depth comes from soft, low, navy-tinted drop shadows with a strong negative spread, so each shadow pools beneath the object instead of haloing it. Surfaces themselves stay flat; the plate and piyola get a gentle radial glaze gradient (white centre to a faint blue edge) to read as glazed porcelain.

### Shadow Vocabulary
- **Plate rest** (`0 34px 46px -30px rgba(18,57,95,0.5)` plus a white top inset and faint blue inner glow): the lagan.
- **Tray rest** (`0 34px 50px -34px rgba(18,57,95,0.6)`): the patnis holding the form.
- **Card rest** (`0 24px 44px -32px rgba(18,57,95,0.7)`, up to `0 30px 50px -36px`): porcelain cards.
- **Cup rest** (`0 12px 18px -12px rgba(18,57,95,0.55)`): piyola medallions.
- **Pill lift** (`0 10px 18px -10px rgba(18,57,95,0.7)`): pill and bar buttons.
- **Pack shadow** (blurred navy ellipse at 30–35% under the pack, plus `drop-shadow(0 18px 16px rgba(18,57,95,0.35))`).

### Named Rules
**The Navy Shadow Rule.** Shadows are tinted with navy (18,57,95), never neutral black, and always use a negative spread so they sit under the object.

## Shapes

Two families. Truly round for table objects — plates, piyolas, avatars, the boll — where the circle is the object's real contour. Generously rounded rectangles for everything that holds text: controls and chips at 1rem, the form card at 1.5rem, panels at 1.75rem, cards at 2rem, trays at 2.25rem (2rem on phones). Trays and the product card take a 3px Piyola Blue outline drawn inside the edge, with a 2px Pattern Soft hairline around the inner surface. Small bullets are 12px squares rotated 45° with a 3px radius (a glaze diamond).

### Named Rules
**The Pattern Is a Rim Rule.** The paxta-guli lattice appears only as rims, bands, plate rings (masked to an annulus) and the cloth under a tray or card. Text never sits directly on the lattice.

## Components

### Buttons
Tactile, glazed and heavy-labelled.
- **Shape:** gently rounded (1rem), 4rem tall, full width on phones.
- **Primary (form submit, "order now" links):** a vertical glaze gradient from Button Top to Button Bottom, white 1.05rem bold label, an inner light knob in Pattern Light Blue on the left holding a dotted double-chevron; on hover, keyboard focus or busy the knob slides across the whole button, the chevrons wave and the label turns Navy Ink. Press scales to 0.98.
- **Pill (header "Консультация"):** solid Piyola Blue, fully round, 3rem, 800 weight; hover to Deep Piyola Blue.
- **On-blue (inside the Piyola Blue panel):** Porcelain fill, Deep Piyola Blue 800 label, 4rem; hover to Sky Cloth.
- **Bottom order bar (phones):** solid Piyola Blue, 1rem radius, 4rem, under a patterned rim.

### Chips (symptom check)
- **Style:** 4rem-min rounded (1rem) buttons, 2px Glaze Line border on translucent porcelain, 1.06rem bold label, a ringed bud on the left.
- **State:** pressed (`aria-pressed`) swaps the border to Piyola Blue, fills porcelain, adds a soft navy shadow, and the bud opens into a white four-lobed cotton boll (staggered 0.45s scale). The count appears in the adjacent Piyola Blue panel.

### Cards / Containers
- **Corner Style:** 2rem cards, 2.25rem tray/product card, 1.75rem secondary reviews.
- **Background:** Porcelain on Sky Cloth or on the paxta-guli cloth; secondary reviews at 80% porcelain.
- **Shadow Strategy:** Card rest (see Elevation).
- **Border:** none, except the tray and product card's inner 3px Piyola Blue outline.
- **Internal Padding:** 1.5rem phone, 2–2.5rem wider.

### Inputs / Fields
- **Style:** 4rem tall, 1rem radius, 2px Glaze Line border, Sky Cloth fill, 1.25rem text; labels 1.125rem bold above. The phone field carries a fixed `+998` prefix divided by a Glaze Line rule.
- **Focus:** border to Piyola Blue, fill to Porcelain, with a 4px soft halo.
- **Error:** border and message in Error Red, 1rem semibold under the field.

### Navigation
A minimal header: the mark (a piyola seen from the side) with the site name in 800 Navy Ink and its kind in bold Deep Piyola Blue, and a blue pill on the right from `sm`. The footer carries bold Deep Piyola Blue links with 44px minimum targets, underline on hover.

### Patnis (order tray)
The signature container: the order form on a porcelain card, set inside a tray whose cloth is the paxta-guli lattice, rimmed with a 3px Piyola Blue line and a Pattern Soft hairline. Its two fields always stack in one column so the phone hint never breaks.

### Lagan and Piyola
The lagan is a round glazed plate whose rim band is the lattice masked to an annulus, with a 3px Piyola Blue outer line and a 2px Pattern Soft inner line; it carries the pack (hero) or the family photo (closing). The piyola is a small round dish (3–4rem) with the same patterned rim and a 2px Piyola Blue edge, holding an icon, a step number or an initial.

### Disclosures
Native details rows between 2px Glaze Line rules; 800-weight summaries at least 4rem tall, a Piyola Blue plus that rotates to a minus, height animated with the expo ease.

## Do's and Don'ts

### Do:
- **Do** keep every UI colour inside the light-blue family; carry the action in Piyola Blue alone.
- **Do** frame Porcelain bands with the patterned rim strip, top and mirrored at the bottom.
- **Do** put icons, numbers and initials in piyola medallions, and media in a lagan.
- **Do** keep body text at 1.125rem or larger and every tap target at least 2.75rem (4rem for primary actions).
- **Do** tint all shadows navy with negative spread so they pool under the object.
- **Do** respect reduced motion: the set-down, the heartbeat and the boll fall back to their resting states.

### Don't:
- **Don't** use red, orange or yellow in the interface to signal danger; say it in words, in navy. Product photography and form-error red are the exceptions.
- **Don't** set text directly on the paxta-guli lattice.
- **Don't** add a second typeface; Nunito carries every role.
- **Don't** lay offer points out as a row of equal icon cards; they are cups around the plate or one sentence along the cloth's edge.
- **Don't** use neutral black shadows or hard offset shadows.
