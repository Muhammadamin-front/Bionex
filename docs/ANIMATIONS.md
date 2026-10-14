# Animation prompts — what was used and why

The project root contains 30 animation prompt files. The goal was a polished page that
stays fast on budget Android phones, so each prompt was judged on:

- does it animate only `transform`/`opacity` (handled by the GPU compositor), or does it
  force repaints/layout every frame (`filter: blur`, `background-position`, canvas loops)?
- does it run forever, or once / on interaction / only while visible?
- how much JavaScript does it add?
- does it fit a product landing page and keep content accessible?

## Used (adapted)

| Prompt | Where | Adaptation |
|---|---|---|
| `prompt (2).md` anti-metal button | All CTAs + submit (`components/ui/AntiMetalButton.tsx`) | Keyframes moved to CSS (works with strict CSP); dot wave runs only on hover/focus/busy instead of forever; at rest the knob shows one solid "»" so it reads as an arrow, not smudges; label stays readable; works as link or button |
| `2-prompt.md` text roll | Accent word in the hero headline (`TextRoll.tsx`) | Rewritten in pure CSS — no `motion` library (~40 KB saved); plays once; text visible from the first frame, so LCP isn't delayed; screen readers get the plain word |
| `prompt-background-light.md` aurora | Hero background (`AuroraBackdrop.tsx`) | Original animates `background-position` under `blur()` + `mix-blend-mode` = full-viewport repaint every frame. Now three soft radial gradients, static (no motion at all): the drift added nothing a reader notices and cost frames on old phones |
| `scroll-web.md` | FAQ and risk disclosures | Native `<details>` with CSS-only plus icon and height animation where supported. (Its per-section scroll reveals were removed in the polish pass: one authored hero moment instead of the same entrance on every section, and content is never hidden waiting for JavaScript.) |

**Heartbeat (Zeynara):** the logo's heart beats and its ECG line re-draws each beat; the heart printed on the pack beats too. For the pack, the heart was cut out of the product photo with a real alpha matte (colour flood-fill + hole filling + 1 px feather → `public/images/zeynara/heart.webp`, 11 KB) and placed exactly over the printed heart, so at rest it is invisible and on each beat it swells by up to 8.5 % with a warm glow behind it. One "lub-dub" keyframe (~63 bpm), transform/opacity only. It beats six times when it comes into view (the pack also when touched or hovered), then rests: endless motion fails WCAG 2.2.2 and distracts older readers. Disabled for reduced motion. If the pack photo changes, the cut-out and its position in `config/product.ts` (`packHeart`) must be regenerated.

The hero is the single authored moment: the pack settles, the seals press on, the accent word rolls and its underline draws — all from an already-visible state. Everything respects `prefers-reduced-motion`.

## Not used

| Prompt | Reason |
|---|---|
| `Hero animate.md`, `liquid-prompt.md` | Three.js/WebGL loaded at runtime from a CDN (also breaks a strict CSP) |
| `shader.md` | Continuous WebGL shaders |
| `kinetic.md`, `prompt (1).md`, `motion.md` | Endless canvas `requestAnimationFrame` loops (cloth physics, grid, 600–2000 particles) — battery and FPS cost |
| `robot.md` | Spline runtime, several MB |
| `4-prompt.md`, `parallax.md` | GSAP Flip / GSAP + Lenis scroll hijacking |
| `3D-char.md`, `retro-char.md`, `animated-planets.md`, `scroltide-website.md` | Large background videos, mouse-scrubbed video |
| `1-prompt.md` image stream | Compositor-only and well built, but 18 constantly moving 3D layers and needs 10+ real images |
| `flip-card.md` | Hides content behind hover — touch phones have no hover |
| `button.md` | Only keyframes were provided; the component's CSS is missing |
| `crousel.md` 3D carousel | Was adapted, then removed: the Zeynara site has a single product photo, so a gallery adds nothing |
| `prompt.md` coverflow | `blur(32px)` background swaps, fixed 330 px widths (not mobile-first), window-wide key handler |
| `reviews-prompt.md` | Testimonials attributed to real people — fake reviews |
| `animated_tooltip.md` | Depends on `next/image` (Next.js), team avatars |
| `3D-statue.md` | Requires a paid React Bits Pro licence |
| `3D-portfolio.md`, `3d-folder.md`, `3D-characters.md` | A different kind of site (portfolio/agency) |
| `login-page-prompt.md` | Placeholder stub (a counter), no real component |

## Result

First load: ~80 KB gzip JS (≈60 KB of it is React DOM) + 9 KB CSS. Zod validation
(~23 KB) and Turnstile load only when the order form approaches the screen; the admin
panel is a separate chunk.
