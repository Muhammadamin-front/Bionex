import type { Utm } from '@bionex/shared/utm';
import { useEffect, useState, type CSSProperties } from 'react';
import { formatPrice, product, site } from '../../config/product';
import { useInView } from '../../lib/in-view';
import { OfferBanner } from '../../lib/offer';
import { AuroraBackdrop } from '../ui/AuroraBackdrop';
import { CheckIcon, icons, PhoneIcon } from '../ui/Icons';
import { ProductPack } from '../ui/ProductPack';
import { TextRoll } from '../ui/TextRoll';
import { OrderForm, type OrderResult } from './OrderForm';

/**
 * Logo: the heart beats a few times (ECG line re-drawing each beat) whenever the header
 * comes into view, then rests. A finite run keeps it within WCAG 2.2.2 and stops it from
 * pulling older readers' eyes away from the text.
 */
function BrandMark() {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (inView) setRun((r) => r + 1);
  }, [inView]);
  return (
    <span ref={ref} className="flex-none">
      <svg viewBox="0 0 40 40" className="h-11 w-11" aria-hidden="true">
        <rect width="40" height="40" rx="12" fill="var(--color-accent)" />
        <g key={run} className={run > 0 ? 'logo-heart' : undefined}>
          <path
            d="M20 30s-9-5.6-9-12.2A5.1 5.1 0 0 1 20 14.6a5.1 5.1 0 0 1 9 3.2C29 24.4 20 30 20 30Z"
            fill="var(--color-forest)"
          />
          <path
            className={run > 0 ? 'logo-ecg' : undefined}
            d="M14.5 20.5h3.2l1.6-3 2.4 6 1.6-3h2.4"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </span>
  );
}

export function Header() {
  return (
    <header className="relative z-20 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6">
      <a href="#asosiy" className="flex min-w-0 items-center gap-2.5 rounded-xl sm:gap-3">
        <BrandMark />
        <span className="leading-tight max-[379px]:sr-only">
          <span className="block font-display text-[1.15rem] font-extrabold tracking-tight text-white sm:text-[1.35rem]">{site.brand}</span>
          <span className="hidden text-[0.95rem] text-on-forest sm:block">{product.tagline}</span>
        </span>
      </a>
      <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
        {site.phone && site.phoneHref && (
          <a
            href={site.phoneHref}
            aria-label={`Қўнғироқ қилиш: ${site.phone}`}
            className="inline-flex h-12 w-12 items-center justify-center gap-2 rounded-full border-2 border-white/25 font-display font-bold text-white transition-colors hover:border-white/50 hover:bg-white/5 sm:w-auto sm:px-4"
          >
            <PhoneIcon className="h-5 w-5 text-accent" />
            <span className="hidden whitespace-nowrap tabular-nums sm:inline">{site.phone}</span>
          </a>
        )}
        <a
          href="#tez-buyurtma"
          className="inline-flex h-12 items-center rounded-full bg-accent px-4 font-display font-bold text-ink shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)] transition-colors hover:bg-accent-2 sm:px-6"
        >
          Консультация
        </a>
      </div>
    </header>
  );
}

/** Hand-drawn stroke under the accent word; drawn once, after the letters roll. */
function DrawnUnderline() {
  return (
    <svg
      viewBox="0 0 300 24"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -bottom-[0.18em] left-[-2%] h-[0.32em] w-[104%] text-accent"
      aria-hidden="true"
    >
      <path
        className="underline-draw"
        d="M4 16C52 7 118 4 176 7c44 2 84 6 120 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Seals pressed onto the scene around the pack — the brand promises as stamps. */
const SEAL_POSITIONS = [
  'left-[-44%] top-[8%] sm:left-[-10%] sm:top-[14%] [--r:-8deg]',
  'right-[-44%] top-[38%] sm:right-[-10%] sm:top-[42%] [--r:7deg]',
  'left-[-40%] bottom-[6%] sm:left-[-6%] sm:bottom-[12%] [--r:-4deg]',
];

function ProductStage() {
  return (
    <div className="relative mx-auto w-full max-w-[11rem] sm:max-w-[19rem] lg:max-w-[22rem]">
      {/* Grounding shadow: offset and soft, so the pack stands on something. */}
      <div aria-hidden="true" className="absolute inset-x-[12%] bottom-[2%] h-[7%] rounded-[50%] bg-black/45 blur-xl" />
      <ProductPack
        priority
        sizes="(min-width: 1024px) 396px, (min-width: 640px) 342px, 198px"
        className="hero-product"
        imgClassName="drop-shadow-[0_28px_28px_rgba(0,0,0,0.45)]"
      />
      <ul aria-label="Маҳсулот хусусиятлари" className="hidden sm:block">
        {product.badges.map((b, i) => (
          <li
            key={b}
            style={{ '--n': i } as CSSProperties}
            className={`hero-seal absolute grid h-[5rem] w-[5rem] place-items-center rounded-full border-2 border-dashed border-forest/30 bg-accent p-1.5 text-center font-display text-[0.72rem] font-extrabold leading-tight text-ink shadow-[0_10px_22px_-8px_rgba(0,0,0,0.55)] sm:h-[6.8rem] sm:w-[6.8rem] sm:text-[0.92rem] ${SEAL_POSITIONS[i] ?? ''}`}
          >
            <span className="flex flex-col items-center gap-0.5">
              <CheckIcon className="h-5 w-5 text-brand-2" />
              {b}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * On phones the seals would be too small to read: the same promises as a plain row, in
 * the system font so they do not re-wrap (and shift the page) when Montserrat arrives.
 */
function MobileBadges() {
  return (
    <ul aria-label="Маҳсулот хусусиятлари" className="mt-5 flex flex-wrap justify-center gap-2 sm:hidden">
      {product.badges.map((b) => (
        <li key={b} className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-base font-bold text-ink">
          <CheckIcon className="h-4 w-4 text-brand-2" />
          {b}
        </li>
      ))}
    </ul>
  );
}

export function Hero() {
  const { hero } = product;
  return (
    <section id="asosiy" className="on-dark relative isolate overflow-hidden bg-forest pb-14 text-white sm:pb-20">
      <AuroraBackdrop />
      <Header />
      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 lg:items-start px-4 pt-6 sm:px-6 sm:pt-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-14 lg:pt-16">
        <div className="order-first px-6 pt-2 sm:px-10 lg:sticky lg:top-10 lg:order-last lg:px-8 lg:pt-6">
          <ProductStage />
          <MobileBadges />
        </div>

        <div className="min-w-0">
          <OfferBanner className="mb-6 w-fit" />
          <h1 className="text-[2.05rem] font-extrabold leading-[1.1] tracking-[-0.02em] text-balance sm:text-5xl lg:text-[3.35rem]">
            {hero.titleStart}{' '}
            <span className="relative inline-block whitespace-nowrap text-accent text-[min(1em,11.5vw)]">
              <TextRoll>{hero.titleAccent}</TextRoll>
              <DrawnUnderline />
            </span>{' '}
            {hero.titleEnd}
          </h1>

          <p className="mt-6 max-w-[38rem] text-xl leading-relaxed text-white">{hero.sub}</p>

          <ul className="mt-6 space-y-2.5">
            {hero.offer.map((o) => {
              const Icon = icons[o.icon];
              return (
                <li key={o.text} className="flex items-center gap-3 text-lg font-semibold text-on-forest">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white/10 text-accent">
                    <Icon />
                  </span>
                  {o.text}
                </li>
              );
            })}
          </ul>

          {product.price !== null && (
            <p className="mt-6 flex items-baseline gap-3 font-display">
              <span className="text-3xl font-extrabold tabular-nums">
                {formatPrice(product.price)} {product.currency}
              </span>
              {product.oldPrice !== null && <s className="text-xl text-on-forest tabular-nums">{formatPrice(product.oldPrice)}</s>}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** The first order form, right after the symptom check: "you have these signs — order now". */
export function QuickOrder({
  sectionRef,
  utm,
  order,
  onOrdered,
}: {
  sectionRef: React.Ref<HTMLElement>;
  utm: Utm;
  order: OrderResult | null;
  onOrdered: (r: OrderResult) => void;
}) {
  return (
    <section id="tez-buyurtma" ref={sectionRef} aria-label="Буюртма формаси" className="on-dark bg-forest px-4 py-12 text-white sm:px-6 sm:py-16">
      <div className="mx-auto max-w-[40rem] [--focus-ring:var(--color-forest)]">
        <OrderForm utm={utm} variant="compact" completed={order} onSuccess={onOrdered} />
      </div>
    </section>
  );
}

/** Delivery and payment promises as one ruled strip under the hero — not a row of cards. */
export function Promises() {
  return (
    <section aria-label="Буюртма шартлари" className="border-b border-line bg-card">
      <ul className="mx-auto grid max-w-6xl grid-cols-2 lg:grid-cols-4">
        {product.promises.map((p, i) => {
          const Icon = icons[p.icon];
          return (
            <li
              key={p.title}
              className={[
                'flex flex-col gap-2 px-4 py-6 sm:flex-row sm:gap-4 sm:px-6',
                i % 2 === 1 ? 'border-l border-line' : '',
                i >= 2 ? 'border-t border-line lg:border-t-0' : '',
                i === 2 ? 'lg:border-l' : '',
              ].join(' ')}
            >
              <span className="text-brand">
                <Icon />
              </span>
              <span>
                <span className="block font-display text-[1.02rem] font-bold leading-snug">{p.title}</span>
                <span className="mt-0.5 block text-[0.95rem] leading-snug text-muted">{p.text}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
