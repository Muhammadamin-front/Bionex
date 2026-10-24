import { useEffect, useMemo, useRef, useState } from 'react';
import type { OrderResult } from '../../components/landing/OrderForm';
import { OrderModal } from '../../components/landing/OrderModal';
import { initPixel } from '../../lib/pixel';
import { captureUtm } from '../../lib/utm';
import { Hero, Promises } from './Hero';
import { About, Faq, Family, Footer, Order, Process, Quote, Reviews, Risks, StickyCta, Symptoms, Usage } from './Sections';

export function Landing() {
  const utm = useMemo(() => captureUtm(), []);
  const quickRef = useRef<HTMLElement>(null);
  const orderRef = useRef<HTMLElement>(null);
  const [quickVisible, setQuickVisible] = useState(false);
  /** A form field has focus: the phone keyboard is open, so the order bar steps aside. */
  const [typing, setTyping] = useState(false);
  // One order result for the whole page: once either form succeeds, both show the confirmation.
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

  useEffect(() => {
    const el = quickRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setQuickVisible(Boolean(e?.isIntersecting)), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <a
        href="#forma"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-brand focus:px-4 focus:py-3 focus:text-white"
      >
        Буюртма формасига ўтиш
      </a>
      <main>
        {/* The guest is seated, the form is on the table, then the reasons follow: what you
            feel, why it matters, what happens in the vessels, what helps, who says so, and the
            order again at the close. */}
        <Hero sectionRef={quickRef} utm={utm} order={order} onOrdered={setOrder} />
        <Promises />
        <Symptoms />
        <Risks />
        <Process />
        <About />
        <Usage />
        <Reviews />
        <Quote />
        <Order utm={utm} orderRef={orderRef} order={order} onOrdered={setOrder} />
        <Faq />
        <Family />
      </main>
      <Footer />
      <StickyCta visible={!typing} quickFormOnScreen={quickVisible && !order} />
      <OrderModal utm={utm} order={order} onOrdered={setOrder} />
    </>
  );
}
