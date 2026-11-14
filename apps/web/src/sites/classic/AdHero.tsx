// The main site's first screen, made to continue the ad (owner, 2026-10-31). Visitors arrive from
// Gulchehra opa's video: they should see her again at once, the product named in the ad's own words,
// the ad's discount and its button — not a box photo with the headline a screen further down. The
// partner site keeps the original first screen (components/landing/Hero.tsx).
// Since 2026-11-14 the order form itself is in this screen (owner, with the targetologist's reading: the form must be
// seen without scrolling): on a phone it sat ~900 px down, under the headline, her quote and a button that only
// scrolled to it. Now: headline, her face and one sentence, then name, number and the button.
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { DrawnUnderline, Header, ProductStage } from '../../components/landing/Hero';
import { AuroraBackdrop } from '../../components/ui/AuroraBackdrop';
import { CheckIcon } from '../../components/ui/Icons';
import { tapOffer, useOffer } from '../../lib/offer';
import { CUSTOMERS } from './stats';

/** The number of customers (stats.ts). In the header, so it costs the first screen no height. */

function Customers() {
  return (
    <p className="ml-auto flex flex-col items-center text-center leading-none sm:ml-6 sm:flex-row sm:items-baseline sm:gap-2">
      <span className="font-display text-[1.15rem] font-extrabold tabular-nums text-accent sm:text-[1.35rem]">{CUSTOMERS}</span>
      <span className="mt-1 text-[0.85rem] font-semibold text-on-forest sm:mt-0 sm:text-[1rem]">мижозларимиз</span>
    </p>
  );
}

/**
 * What the ad's last screen promises, in the ad's order — but not its «Бепул консультация» (owner, 2026-11-14: the page
 * asks for an «ариза» for Zeynara, not for a consultation; consultation drew people who only wanted the price).
 */
const PROMISES = ['Олдиндан тўлов йўқ', 'Бепул етказиб бериш', '1–3 кунда уйингизгача'];

function PlayIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Her face from the ad, ringed in yellow as the ad frames its customers, and her own words beside it
 * (on a phone small, and only her last sentence, so the form below still fits the first screen).
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
    <figure className="mt-3 flex items-center gap-3.5 sm:mt-8 sm:gap-6 lg:mt-6">
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label="Гулчеҳра опанинг видеосини кўриш"
        className="group/play relative flex-none rounded-full"
      >
        <img src={face} alt="" width={300} height={300} className="h-14 w-14 rounded-full object-cover ring-[3px] ring-accent ring-offset-2 ring-offset-forest sm:h-36 sm:w-36 lg:h-28 lg:w-28" />
        <span className="absolute -bottom-1.5 -right-1.5 grid h-8 w-8 place-items-center rounded-full bg-accent pl-0.5 text-ink shadow-[0_8px_16px_-6px_rgba(0,0,0,0.6)] transition-transform group-hover/play:scale-105 sm:-bottom-1 sm:-right-1 sm:h-11 sm:w-11">
          <PlayIcon className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
      </button>
      <figcaption className="min-w-0">
        <blockquote className="text-[1.02rem] font-semibold leading-snug text-white sm:text-[1.3rem]">
          <span className="hidden sm:inline">«Тез чарчоқ, уйқусизлик мени безовта қиларди. Ҳозир ўзимни жуда яхши ҳис қиламан.»</span>
          <span className="sm:hidden">«Ҳозир ўзимни жуда яхши ҳис қиламан.»</span>
        </blockquote>
        <p className="mt-1 text-[0.95rem] font-bold text-accent sm:mt-1.5 sm:text-[0.98rem]">Гулчеҳра опа, 55 ёш</p>
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

/** The discount (none since 2026-11-06): to the form, with the name field ready to type in. */
function orderWithOffer(e: React.MouseEvent) {
  tapOffer();
  const name = document.querySelector<HTMLInputElement>('#tez-buyurtma form input[name=zn-customer]');
  if (!name) return;
  e.preventDefault();
  name.scrollIntoView({ block: 'center', behavior: 'smooth' });
  name.focus({ preventScroll: true });
}

/** `form`: the first order form (Landing.tsx), placed here so it is on the first screen. */
export function AdHero({ video, poster, face, form }: { video: string; poster: string; face: string; form: ReactNode }) {
  return (
    <section id="asosiy" className="on-dark relative isolate overflow-hidden bg-forest pb-10 text-white sm:pb-20">
      <AuroraBackdrop />
      {/* No «Консультация» button: the form it pointed to is right here. */}
      <Header cta={false} note={<Customers />} />
      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pt-2 sm:px-6 sm:pt-12 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-14 lg:pt-8">
        <div className="min-w-0">
          {/* Three lines' room on a phone: with the stand-in font it took two, and when Montserrat arrived the third
              pushed the form down ~29 px, perhaps under a finger about to tap it. */}
          <h1 className="text-[clamp(1.4rem,6.4vw,1.65rem)] max-sm:min-h-[3.3em] font-extrabold leading-[1.1] tracking-[-0.02em] text-balance sm:text-5xl lg:text-[2.75rem]">
            Юрак ва қон томирлар учун{' '}
            <span className="relative inline-block whitespace-nowrap text-accent">
              табиий
              <DrawnUnderline />
            </span>{' '}
            ўсимлик сиропи
          </h1>

          <Testimonial video={video} poster={poster} face={face} />

          <OfferLine />

          {/* The form: name, number, button. The phones' order bar steps aside while it is on screen. */}
          <div className="mt-3.5 sm:mt-8 lg:mt-6">{form}</div>

          <ul className="mt-5 grid gap-1.5 sm:mt-6 sm:flex sm:flex-wrap sm:gap-x-6">
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
