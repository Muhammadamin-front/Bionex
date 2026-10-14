import { useEffect, useMemo, useRef, useState } from 'react';
import { initPixel } from '../../lib/pixel';
import { captureUtm } from '../../lib/utm';
import { Hero, Promises } from './Hero';
import type { OrderResult } from './OrderForm';
import {
  About,
  Expert,
  Faq,
  Family,
  Footer,
  Ingredients,
  Order,
  Process,
  Reviews,
  Risks,
  StickyCta,
  Symptoms,
  Usage,
} from './Sections';

export function Landing() {
  const utm = useMemo(() => captureUtm(), []);
  const heroRef = useRef<HTMLElement>(null);
  const orderRef = useRef<HTMLElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);
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

  // Whether the first-screen form is on screen, so the order bar can point to it.
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setHeroVisible(Boolean(e?.isIntersecting)), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <a
        href="#forma"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-forest focus:px-4 focus:py-3 focus:text-white"
      >
        Буюртма формасига ўтиш
      </a>
      <main>
        <Hero heroRef={heroRef} utm={utm} order={order} onOrdered={setOrder} />
        <Promises />
        <Risks />
        <Expert />
        <Symptoms />
        <Process />
        <About />
        <Ingredients />
        <Usage />
        <Reviews />
        <Order utm={utm} orderRef={orderRef} order={order} onOrdered={setOrder} />
        <Faq />
        <Family />
      </main>
      <Footer />
      {/* Always on screen (except while typing), as the owner asked. */}
      <StickyCta visible={!typing} heroFormOnScreen={heroVisible && !order} />
    </>
  );
}
