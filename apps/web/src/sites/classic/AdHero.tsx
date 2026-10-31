// The main site's first screen, made to continue the ad (owner, 2026-10-31). Visitors arrive from
// Gulchehra opa's video: they should see her again at once, the product named in the ad's own words,
// the ad's discount and its button — not a box photo with the headline a screen further down. The
// partner site keeps the original first screen (components/landing/Hero.tsx).
import { useEffect, useRef, useState } from 'react';
import { DrawnUnderline, Header, ProductStage } from '../../components/landing/Hero';
import { AntiMetalLink } from '../../components/ui/AntiMetalButton';
import { AuroraBackdrop } from '../../components/ui/AuroraBackdrop';
import { CheckIcon } from '../../components/ui/Icons';
import { tapOffer, useOffer } from '../../lib/offer';

/** What the ad's last screen promises, in the ad's order. */
const PROMISES = ['Олдиндан тўлов йўқ', 'Бепул етказиб бериш', 'Бепул консультация'];

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Her face from the ad, ringed in yellow as the ad frames its customers, and her own words beside it.
 * A tap opens her video in its place, large, with sound (the tap allows it); it pauses once scrolled
 * away, so it never talks over the videos further down.
 */
function Testimonial({ video, poster, face }: { video: string; poster: string; face: string }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!playing || !v || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => e && !e.isIntersecting && v.pause(), { threshold: 0 });
    io.observe(v);
    return () => io.disconnect();
  }, [playing]);

  if (playing) {
    return (
      <video
        ref={ref}
        className="mx-auto mt-6 block aspect-[9/16] max-h-[78svh] w-full max-w-[24rem] rounded-3xl bg-ink object-cover shadow-[0_22px_36px_-22px_rgba(0,0,0,0.8)]"
        src={video}
        poster={poster}
        controls
        autoPlay
        playsInline
        aria-label="Гулчеҳра опа ҳикояси"
      />
    );
  }
  return (
    <figure className="mt-5 flex items-center gap-4 sm:mt-8 sm:gap-6">
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label="Гулчеҳра опанинг видеосини кўриш"
        className="group/play relative flex-none rounded-full"
      >
        <img src={face} alt="" width={300} height={300} className="h-[6.5rem] w-[6.5rem] rounded-full object-cover ring-[3px] ring-accent ring-offset-2 ring-offset-forest sm:h-36 sm:w-36" />
        <span className="absolute -bottom-1 -right-1 grid h-11 w-11 place-items-center rounded-full bg-accent pl-0.5 text-ink shadow-[0_8px_16px_-6px_rgba(0,0,0,0.6)] transition-transform group-hover/play:scale-105">
          <PlayIcon />
        </span>
      </button>
      <figcaption className="min-w-0">
        <blockquote className="text-[1.08rem] font-semibold leading-snug text-white sm:text-[1.3rem]">
          «Тез чарчоқ, уйқусизлик мени безовта қиларди. Ҳозир ўзимни жуда яхши ҳис қиламан.»
        </blockquote>
        <p className="mt-1.5 text-[0.98rem] font-bold text-accent">Гулчеҳра опа, 55 ёш</p>
      </figcaption>
    </figure>
  );
}

/**
 * The ad's discount as one compact red ticket. The forms' OfferBanner sets its line in capitals and
 * wraps to four lines on a phone; here it must leave room for the rest of the first screen. People
 * press a discount, so it takes them to the form too, and the order then carries the sticker.
 */
function OfferLine() {
  const offer = useOffer();
  if (!offer) return null;
  return (
    <a
      href="#tez-buyurtma"
      onClick={orderWithOffer}
      className="mt-5 flex items-center gap-3 rounded-2xl bg-danger px-3.5 py-3 text-white shadow-[0_12px_26px_-14px_rgba(180,35,24,0.9)] transition-transform active:scale-[0.98] sm:mt-7 sm:w-fit sm:px-4 sm:pr-6"
    >
      <span className="flex-none font-display text-[clamp(1.6rem,7.4vw,2.2rem)] font-extrabold leading-none tabular-nums">−{offer.percent}%</span>
      <span className="min-w-0 leading-snug">
        <span className="block font-display text-[clamp(0.95rem,4.3vw,1.1rem)] font-extrabold">Чегирма {offer.untilText}</span>
        {offer.pensioners > 0 && <span className="block text-[clamp(0.95rem,4.3vw,1.05rem)] font-semibold">Нафақахўрларга −{offer.pensioners}%</span>}
      </span>
    </a>
  );
}

/** «Ҳозироқ буюртма беринг»: to the first form, right below, with the name field ready to type in. */
function orderWithOffer(e: React.MouseEvent) {
  tapOffer();
  const name = document.querySelector<HTMLInputElement>('#tez-buyurtma form input[name=zn-customer]');
  if (!name) return;
  e.preventDefault();
  name.scrollIntoView({ block: 'center', behavior: 'smooth' });
  name.focus({ preventScroll: true });
}

export function AdHero({ video, poster, face }: { video: string; poster: string; face: string }) {
  return (
    <section id="asosiy" className="on-dark relative isolate overflow-hidden bg-forest pb-8 text-white sm:pb-20">
      <AuroraBackdrop />
      <Header />
      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pt-4 sm:px-6 sm:pt-12 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-14 lg:pt-16">
        <div className="min-w-0">
          <h1 className="text-[1.65rem] font-extrabold leading-[1.1] tracking-[-0.02em] text-balance sm:text-5xl lg:text-[3.2rem]">
            Юрак ва қон томирлар учун{' '}
            <span className="relative inline-block whitespace-nowrap text-accent">
              табиий
              <DrawnUnderline />
            </span>{' '}
            ўсимлик сиропи
          </h1>

          <Testimonial video={video} poster={poster} face={face} />

          <OfferLine />

          {/* This screen's own button: the phones' order bar steps aside while it is in view
              (data-order-button, Landing.tsx), and also while the form below is. */}
          <AntiMetalLink href="#tez-buyurtma" onClick={orderWithOffer} tone="accent" data-order-button="" className="mt-4 w-full sm:w-auto">
            <span className="whitespace-nowrap text-[clamp(0.95rem,4.4vw,1.05rem)]">Ҳозироқ буюртма беринг</span>
          </AntiMetalLink>

          <ul className="mt-4 grid gap-1.5 sm:mt-6 sm:flex sm:flex-wrap sm:gap-x-6">
            {PROMISES.map((p) => (
              <li key={p} className="flex items-center gap-2 text-[1.02rem] font-semibold text-on-forest">
                <CheckIcon className="h-5 w-5 flex-none text-accent" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden px-8 lg:block">
          <ProductStage />
        </div>
      </div>
    </section>
  );
}
