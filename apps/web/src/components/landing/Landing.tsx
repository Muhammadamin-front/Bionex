import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { initPixel } from '../../lib/pixel';
import { captureUtm } from '../../lib/utm';
import { Hero, Promises, QuickOrder } from './Hero';
import type { OrderResult } from './OrderForm';
import { OrderModal } from './OrderModal';
import {
  About,
  Expert,
  Faq,
  Family,
  Footer,
  Order,
  Process,
  Reviews,
  Risks,
  StickyCta,
  Symptoms,
  Usage,
} from './Sections';

/**
 * `proof`: what the main site adds above the first form (real customers' videos, the certificate).
 * `popup: false`: no order dialog on arrival (the main site — it would cover the proof).
 * `barOverForms: false`: the bottom order bar steps aside while a form is on screen (the main site),
 * so it can never cover the form's own button.
 * The partner site passes nothing, so its page stays exactly as it was.
 */
export function Landing({ proof, popup = true, barOverForms = true }: { proof?: ReactNode; popup?: boolean; barOverForms?: boolean } = {}) {
  const utm = useMemo(() => captureUtm(), []);
  const quickRef = useRef<HTMLElement>(null);
  const orderRef = useRef<HTMLElement>(null);
  const [quickVisible, setQuickVisible] = useState(false);
  const [orderVisible, setOrderVisible] = useState(false);
  /** A form field has focus: the phone keyboard is open, so the order bar steps aside. */
  const [typing, setTyping] = useState(false);
  // One order result for the whole page: once either form succeeds, both show the
  // confirmation and the sticky bar stops asking to order.
  const [order, setOrder] = useState<OrderResult | null>(null);

  useEffect(() => {
    initPixel();
  }, []);

  useEffect(() => {
    const isField = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
    const onIn = (e: FocusEvent) => isField(e.target) && setTyping(true);
    const onOut = (e: FocusEvent) => isField(e.target) && setTyping(false);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  // Whether the first order form is on screen, so the order bar can point to it.
  useEffect(() => {
    const el = quickRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setQuickVisible(Boolean(e?.isIntersecting)), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // And the bottom form, for `barOverForms: false`.
  useEffect(() => {
    const el = orderRef.current;
    if (barOverForms || !el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOrderVisible(Boolean(e?.isIntersecting)), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [barOverForms]);
  const formOnScreen = !barOverForms && (quickVisible || orderVisible);

  return (
    <>
      <a
        href="#forma"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-forest focus:px-4 focus:py-3 focus:text-white"
      >
        Буюртма формасига ўтиш
      </a>
      <main>
        {/* The visitor's path. Most arrive from the Instagram video, which has already named
            the illness and the product, so they are ready to order: the form comes first and
            the symptom check stays right below it for whoever still needs convincing. */}
        <Hero />
        {/* Main site: the proof between the product and the form, so whoever scrolls on undecided
            meets the videos and the certificate first and the form right under them. */}
        {proof}
        <QuickOrder sectionRef={quickRef} utm={utm} order={order} onOrdered={setOrder} />
        <Symptoms />
        <Promises />
        <Risks />
        <Expert />
        <Process />
        <About />
        <Usage />
        <Reviews />
        <Order utm={utm} orderRef={orderRef} order={order} onOrdered={setOrder} />
        <Faq />
        <Family />
      </main>
      <Footer />
      {/* Always on screen (except while typing), as the owner asked. */}
      <StickyCta visible={!typing && !formOnScreen} quickFormOnScreen={quickVisible && !order} />
      {/* Over everything: the form meets the visitor instead of waiting to be scrolled to. */}
      {popup && <OrderModal utm={utm} order={order} onOrdered={setOrder} />}
    </>
  );
}
