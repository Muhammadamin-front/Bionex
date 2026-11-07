// Shared by the main page (index.tsx) and the workers.dev test page (plain.tsx): the state certificate,
// and the hook that holds pictures far down the page back until the visitor comes near them.
import { type RefObject, useEffect, useRef, useState } from 'react';

/**
 * True once the element comes within a screen or so of the visible part of the page; never before the page
 * is taken over (the prerendered HTML has no picture to fetch). Measured 2026-11-06 on a throttled phone:
 * the video covers and the certificate (~400 KB, all far down the page) downloaded at once beside the
 * script that makes the form work, so on slow 3G the form could be typed into only after 14.7 s
 * (the partner page: 4.4 s). `loading="lazy"` did not help: on slow networks Chrome fetches 2500 px ahead.
 */
export function useNear<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setNear(true), { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near];
}

/**
 * The Ministry of Health's sanitary-epidemiological certificate № 482583 for «Зейнара». It states safety,
 * not efficacy: keep the wording to that (AGENTS.md #28).
 */
export function Certificate({ full, small, spaced }: { full: string; small?: string; spaced: boolean }) {
  const [ref, near] = useNear<HTMLAnchorElement>();
  return (
    <figure
      className={`grid grid-cols-1 items-center gap-6 rounded-3xl bg-card p-6 shadow-[0_18px_40px_-28px_rgba(13,58,39,0.45)] sm:grid-cols-[12rem_1fr] sm:p-8 ${spaced ? 'mt-10' : ''}`}
    >
      <a ref={ref} href={full} target="_blank" rel="noopener" className="mx-auto block w-40 sm:w-48">
        {/* width/height keep its place on the page before the picture is fetched. */}
        <img
          src={near ? (small ?? full) : undefined}
          width={480}
          height={643}
          alt="Санитария-эпидемиологик хулоса № 482583"
          className="h-auto w-full rounded-xl border border-line bg-paper-2"
        />
      </a>
      <figcaption>
        <h3 className="font-display text-xl font-extrabold sm:text-2xl">Давлат текширувидан ўтган</h3>
        <p className="mt-3 text-lg leading-relaxed text-ink-2">
          Ўзбекистон Республикаси Соғлиқни сақлаш вазирлигининг санитария-эпидемиологик хулосаси № 482583: «Зейнара» сиропи хавфсизлик
          кўрсаткичлари бўйича санитария меъёрларига мос. 29.07.2028 гача амал қилади.
        </p>
        <a href={full} target="_blank" rel="noopener" className="mt-4 inline-block font-bold text-brand underline underline-offset-4">
          Ҳужжатни тўлиқ кўриш
        </a>
      </figcaption>
    </figure>
  );
}
