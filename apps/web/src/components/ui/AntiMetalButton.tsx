import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Adapted from prompt (2).md ("anti-metal button").
 * Changes for performance and accessibility:
 *  - keyframes live in styles.css (no inline <style>, so a strict CSP works);
 *  - each chevron is one path (the original drew ten circles each: ~80 nodes per button);
 *  - the wave runs only on hover / keyboard focus / busy, not forever;
 *  - the label stays readable above the expanding slider;
 *  - typed, and usable as a link or a button.
 */

/** The 10 dots of one double chevron, as a single path (one DOM node instead of ten). */
const CHEVRON_PATH = [
  [2, 2], [5, 5], [8, 8], [5, 11], [2, 14],
  [6, 2], [9, 5], [12, 8], [9, 11], [6, 14],
]
  .map(([cx, cy]) => `M${cx! - 1} ${cy}a1 1 0 1 0 2 0a1 1 0 1 0 -2 0`)
  .join('');

function DoubleChevron({ index }: { index: number }) {
  return (
    <svg
      width="14"
      height="16"
      viewBox="0 0 14 16"
      aria-hidden="true"
      focusable="false"
      className="bd-chev shrink-0 overflow-visible"
      style={{ animationDelay: `${index * 0.12}s` }}
    >
      <path d={CHEVRON_PATH} fill="currentColor" />
    </svg>
  );
}

type Tone = 'forest' | 'accent';

const shell =
  'am-btn group/btn relative inline-flex h-16 min-w-0 select-none sm:min-w-60 items-center overflow-hidden rounded-2xl font-display ' +
  'transition-transform duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70';

const TONES: Record<Tone, { body: string; slider: string; label: string }> = {
  // Green body, yellow slider — for light surfaces.
  // Colours can be re-themed per site (--btn-*); the defaults are the original green.
  forest: {
    body: 'bg-[linear-gradient(180deg,var(--btn-top,#1d8a55)_0%,var(--btn-bottom,#0d3a27)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_-8px_var(--btn-shadow,rgba(13,58,39,0.55))]',
    slider: 'linear-gradient(180deg, var(--color-accent) 0%, var(--color-accent-2) 100%)',
    label: 'text-white group-hover/btn:text-ink group-focus-visible/btn:text-ink group-data-[busy=true]/btn:text-ink',
  },
  // Yellow body, green slider — for the forest hero, where a green button would vanish.
  accent: {
    body: 'bg-[linear-gradient(180deg,#ffd666_0%,#f2b10c_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_12px_28px_-10px_rgba(0,0,0,0.6)]',
    slider: 'linear-gradient(180deg, #1d8a55 0%, #0f5c37 100%)',
    label: 'text-ink group-hover/btn:text-white group-focus-visible/btn:text-white group-data-[busy=true]/btn:text-white',
  },
};

function Inner({ children, tone }: { children: ReactNode; tone: Tone }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'absolute bottom-1.5 left-1.5 top-1.5 z-10 flex w-11 items-center justify-start gap-4 overflow-hidden rounded-xl pl-[calc((2.75rem_-_14px)/2)] pr-2.5 transition-[width] duration-300 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover/btn:w-[calc(100%-0.75rem)] group-focus-visible/btn:w-[calc(100%-0.75rem)] group-data-[busy=true]/btn:w-[calc(100%-0.75rem)]',
          tone === 'forest' ? 'text-ink' : 'text-accent',
        )}
        style={{
          background: TONES[tone].slider,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 4px rgba(0,0,0,0.12)',
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <DoubleChevron key={i} index={i} />
        ))}
      </span>
      <span
        className={cn(
          'relative z-20 flex w-full items-center justify-end gap-2 pl-16 pr-5 text-[1.05rem] font-bold tracking-tight transition-colors duration-300',
          TONES[tone].label,
        )}
      >
        {children}
      </span>
    </>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; tone?: Tone };

export function AntiMetalButton({ className, children, busy, tone = 'forest', ...props }: ButtonProps) {
  return (
    <button className={cn(shell, TONES[tone].body, className)} data-busy={busy ? 'true' : undefined} aria-busy={busy || undefined} {...props}>
      <Inner tone={tone}>{children}</Inner>
    </button>
  );
}

export function AntiMetalLink({
  className,
  children,
  tone = 'forest',
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { tone?: Tone }) {
  return (
    <a className={cn(shell, TONES[tone].body, className)} {...props}>
      <Inner tone={tone}>{children}</Inner>
    </a>
  );
}
