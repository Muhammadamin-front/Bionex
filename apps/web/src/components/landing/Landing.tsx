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
  const [orderVisible, setOrderVisible] = useState(false);
  // One order result for the whole page: once either form succeeds, both show the
  // confirmation and the sticky bar stops asking to order.
  const [order, setOrder] = useState<OrderResult | null>(null);

  useEffect(() => {
    initPixel();
  }, []);

  // The mobile order bar shows once the hero has scrolled away, and hides again while
  // the real form is on screen. Two IntersectionObservers — no scroll listener.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const watch = (el: Element | null, set: (v: boolean) => void) => {
      if (!el) return () => {};
      const io = new IntersectionObserver(([e]) => set(Boolean(e?.isIntersecting)), { threshold: 0 });
      io.observe(el);
      return () => io.disconnect();
    };
    const a = watch(heroRef.current, setHeroVisible);
    const b = watch(orderRef.current, setOrderVisible);
    return () => {
      a();
      b();
    };
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
      <StickyCta visible={!order && !heroVisible && !orderVisible} />
    </>
  );
}
