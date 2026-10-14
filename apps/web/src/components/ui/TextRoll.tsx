import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';

/**
 * Rolling letters, adapted from 2-prompt.md (motion-primitives TextRoll).
 * The original animates every letter with the `motion` library (~40 KB); this version
 * is pure CSS keyframes on `transform`, plays once, and costs nothing after that.
 * The text is visible from the first frame, so it never delays Largest Contentful Paint.
 */
export function TextRoll({ children, className }: { children: string; className?: string }) {
  const letters = Array.from(children);
  return (
    <span className={cn('text-roll', className)}>
      <span className="sr-only">{children}</span>
      {letters.map((letter, i) => {
        const ch = letter === ' ' ? ' ' : letter;
        return (
          <span key={i} aria-hidden="true" className="text-roll__cell" style={{ '--i': i } as CSSProperties}>
            <span className="text-roll__out">{ch}</span>
            <span className="text-roll__in">{ch}</span>
            <span className="text-roll__ghost">{ch}</span>
          </span>
        );
      })}
    </span>
  );
}
