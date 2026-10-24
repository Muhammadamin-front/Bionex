import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { ProductPack } from '../../components/ui/ProductPack';

/** The site's own name, shown to visitors (the product stays Зейнара). */
export const SITE = {
  name: 'Оромгоҳ',
  kind: 'даволаш маскани',
  full: 'Оромгоҳ даволаш маскани',
};

export function Title({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn('text-[1.85rem] font-extrabold leading-[1.15] tracking-[-0.015em] text-ink text-balance sm:text-[2.5rem]', className)}>
      {children}
    </h2>
  );
}

/** A piyola's rim as a band between two parts of the cloth. */
export function Rim({ down, className }: { down?: boolean; className?: string }) {
  return <div aria-hidden="true" className={cn('rim', down && 'rim--down', className)} />;
}

/** The mark: a piyola from the side, with the pattern band and one boll. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="var(--color-card)" />
      <path d="M7 15h26c0 8.3-5.8 15-13 15S7 23.3 7 15Z" fill="var(--color-brand)" />
      <path d="M7.6 18.5h24.8" stroke="var(--color-accent)" strokeWidth="2" />
      <circle cx="20" cy="23.5" r="2.6" fill="#fff" />
      <path d="M13 32.5h14" stroke="var(--color-accent-2)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** The lagan with the pack standing on it. */
export function PlateWithPack({ className, priority, sizes }: { className?: string; priority?: boolean; sizes: string }) {
  return (
    <div className={cn('relative', className)}>
      <div className="lagan set-down">
        <span className="lagan__ring" aria-hidden="true" />
        <span className="lagan__line lagan__line--outer" aria-hidden="true" />
        <span className="lagan__line lagan__line--inner" aria-hidden="true" />
      </div>
      {/* The pack stands in the plate's well and rises above its rim. */}
      <div className="absolute bottom-[19%] left-1/2 w-[40%] -translate-x-1/2">
        <div aria-hidden="true" className="absolute inset-x-[6%] -bottom-[2%] h-[8%] rounded-[50%] bg-[rgba(18,57,95,0.35)] blur-md" />
        <ProductPack priority={priority} sizes={sizes} imgClassName="drop-shadow-[0_18px_16px_rgba(18,57,95,0.35)]" />
      </div>
    </div>
  );
}

/** A cotton boll that opens when `open`: the signature of the symptom check. */
export function Boll({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('boll', className)} data-open={open} aria-hidden="true">
      <g className="boll__bud" fill="var(--pattern-mid)">
        <path d="M16 16C18 14 21.5 13.8 23.8 16 21.5 18.2 18 18 16 16Z" />
        <path d="M16 16C14 18 13.8 21.5 16 23.8 18.2 21.5 18 18 16 16Z" />
        <path d="M16 16C14 14 10.5 13.8 8.2 16 10.5 18.2 14 18 16 16Z" />
        <path d="M16 16C18 14 18.2 10.5 16 8.2 13.8 10.5 14 14 16 16Z" />
      </g>
      <g fill="#fff" stroke="var(--color-brand)" strokeWidth="1.3">
        <circle className="boll__lobe" cx="16" cy="11" r="5.2" />
        <circle className="boll__lobe" cx="21" cy="16" r="5.2" />
        <circle className="boll__lobe" cx="16" cy="21" r="5.2" />
        <circle className="boll__lobe" cx="11" cy="16" r="5.2" />
      </g>
    </svg>
  );
}

/** A small open boll as a list mark. */
export function BollTick({ className }: { className?: string }) {
  return <Boll open className={cn('mt-0.5 h-7 w-7 flex-none', className)} />;
}

