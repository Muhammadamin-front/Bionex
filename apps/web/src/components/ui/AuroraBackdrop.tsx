/**
 * Soft light behind the hero, adapted from prompt-background-light.md.
 *
 * The original animates `background-position` on a full-screen layer with
 * `filter: blur()` and `mix-blend-mode: difference`, which repaints the whole viewport
 * every frame. Here three pre-softened radial gradients give the same depth, held still:
 * nothing moves behind the text, and nothing costs battery on budget phones.
 */
export function AuroraBackdrop() {
  return (
    <div className="aurora" aria-hidden="true">
      <div className="aurora__blob aurora__blob--a" />
      <div className="aurora__blob aurora__blob--b" />
      <div className="aurora__blob aurora__blob--c" />
    </div>
  );
}
