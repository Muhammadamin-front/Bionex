import type { Utm } from '@bionex/shared/utm';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AskConcernContext } from '../../lib/concern';
import { OrderForm, type OrderResult } from './OrderForm';

/**
 * The order form as a dialog over the page, opened as soon as the site loads.
 *
 * Almost every visitor arrives from the Instagram video, which has already named the illness
 * and the product: they are ready to leave a number, not to read. The form used to sit four
 * screens down, where most phones never scroll, so it is brought to them instead.
 *
 * It is a dialog, not a trap: a close button, Escape and the backdrop all dismiss it, and
 * once an order is placed it steps aside by itself so the page can still be read.
 */

/** Closing it is remembered for the tab, so a reader is not interrupted twice. */
const SEEN_KEY = 'zeynara.order-modal';
/** Let the page paint first — a dialog over a blank screen looks like a broken site. */
const OPEN_DELAY_MS = 600;
/**
 * How long the confirmation stays before the dialog gets out of the customer's way. Short on
 * purpose: the same confirmation stays on the page behind, so nothing is lost by closing early.
 */
const CLOSE_AFTER_SUCCESS_MS = 2000;

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';

export function OrderModal({
  utm,
  order,
  onOrdered,
}: {
  utm: Utm;
  order: OrderResult | null;
  onOrdered: (r: OrderResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Private mode or storage disabled: the dialog simply opens again next time.
    }
  }, []);

  // Open on arrival, unless this tab has already seen it or an order is somehow done.
  useEffect(() => {
    if (order) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      seen = false;
    }
    if (seen) return;
    const timer = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
    // Deliberately runs once: a later order must not re-trigger the opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While open: the page behind does not scroll, Escape closes, and Tab stays inside.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // The dialog itself takes focus, not the name field: focusing an input would throw the
    // phone keyboard open over the offer before the visitor has read a word of it.
    panel.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusTo.current?.focus();
    };
  }, [open, close]);

  // Ordered: show the confirmation, then step aside so the page can be read — unless the thank-you
  // screen asks a question (lib/concern.tsx): then the visitor closes it.
  const asks = useContext(AskConcernContext);
  useEffect(() => {
    if (!open || !order || asks) return;
    const timer = window.setTimeout(close, CLOSE_AFTER_SUCCESS_MS);
    return () => window.clearTimeout(timer);
  }, [open, order, close, asks]);

  if (!open) return null;

  return (
    // Scrolling lives on the outer box and centring on the inner one. Centring directly on a
    // scroll container would push the top of a tall form above the scrollable area, where no
    // phone can reach it — on a small screen the form is always taller than the viewport.
    <div className="fixed inset-0 z-[999] overflow-y-auto overscroll-contain bg-ink/75 backdrop-blur-sm">
      <div
        className="flex min-h-full items-center justify-center px-4 py-6"
        // mousedown, not click: releasing the button over the backdrop after selecting text
        // inside the form must not count as "clicked outside".
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Буюртма формаси" tabIndex={-1} className="w-full max-w-[32rem] outline-none">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={close}
              aria-label={order ? 'Ёпиш ва сайтни кўриш' : 'Ёпиш'}
              className="grid h-12 w-12 place-items-center rounded-full border-2 border-white/30 text-white transition-colors hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="pop-in">
            <OrderForm utm={utm} variant="compact" completed={order} onSuccess={onOrdered} />
          </div>
        </div>
      </div>
    </div>
  );
}
