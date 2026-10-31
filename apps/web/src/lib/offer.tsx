import { createContext, useContext, useEffect, useState } from 'react';
import { cn } from './cn';

/**
 * A discount the site announces (the main site's, 2026-10-30: the ad video promises it, so the page
 * must too). Provided by the site (sites/classic); the partner page has none. It disappears by itself
 * once `until` has passed — checked after the page is taken over, so the prerendered HTML still
 * matches the first render.
 */
export interface Offer {
  percent: number;
  /** A bigger discount for pensioners, or 0. */
  pensioners: number;
  /** ISO time the offer ends. */
  until: string;
  /** «8 ноябргача». */
  untilText: string;
}

export const OfferContext = createContext<Offer | null>(null);

export function useOffer(): Offer | null {
  const offer = useContext(OfferContext);
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (offer && Date.now() > Date.parse(offer.until)) setOver(true);
  }, [offer]);
  return offer && !over ? offer : null;
}

/**
 * Whether the visitor pressed the discount itself (the first screen's ticket and button, the bottom
 * bar) before ordering (owner, 2026-10-31): the order then arrives with a sticker by the name, so the
 * operator knows the customer came for it. Kept for the tab, so a reload in between still counts.
 */
const TAPPED_KEY = 'zeynara.offer-tapped';
let tapped = false;

export function tapOffer(): void {
  tapped = true;
  try {
    sessionStorage.setItem(TAPPED_KEY, '1');
  } catch {
    // Storage blocked: this page view still remembers it.
  }
}

export function offerTapped(): boolean {
  if (tapped) return true;
  try {
    return sessionStorage.getItem(TAPPED_KEY) === '1';
  } catch {
    return false;
  }
}

/** The discount as a red ticket, as in the ad: «−25% ЧЕГИРМА · 8 ноябргача · нафақахўрларга −35%». */
export function OfferBanner({ className }: { className?: string }) {
  const offer = useOffer();
  if (!offer) return null;
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl bg-danger px-4 py-3 text-white shadow-[0_12px_26px_-14px_rgba(180,35,24,0.9)]', className)}>
      <span className="flex-none whitespace-nowrap font-display text-[2rem] font-extrabold leading-none tabular-nums">−{offer.percent}%</span>
      <span className="min-w-0 leading-snug">
        <span className="block font-display text-[1.05rem] font-extrabold uppercase tracking-wide">Чегирма {offer.untilText}</span>
        {offer.pensioners > 0 && <span className="block text-[0.98rem] font-semibold">Нафақахўрларга −{offer.pensioners}%</span>}
      </span>
    </div>
  );
}
