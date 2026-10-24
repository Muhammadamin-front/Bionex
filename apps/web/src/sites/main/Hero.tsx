import type { Utm } from '@bionex/shared/utm';
import { cn } from '../../lib/cn';
import { formatPrice, product, site } from '../../config/product';
import { OrderForm, type OrderResult } from '../../components/landing/OrderForm';
import { icons, PhoneIcon } from '../../components/ui/Icons';
import { Boll, Mark, PlateWithPack, Rim, SITE } from './parts';

export function Header() {
  return (
    <header className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6">
      <a href="#asosiy" className="flex min-w-0 items-center gap-2.5 rounded-xl sm:gap-3">
        <Mark className="h-10 w-10 flex-none sm:h-12 sm:w-12 drop-shadow-[0_6px_10px_rgba(18,57,95,0.18)]" />
        <span className="min-w-0 leading-none">
          <span className="block whitespace-nowrap text-[1.25rem] font-extrabold tracking-[-0.01em] text-ink sm:text-[1.65rem]">{SITE.name}</span>
          <span className="mt-1 block whitespace-nowrap text-[0.82rem] font-bold text-brand-2 sm:text-[0.95rem]">{SITE.kind}</span>
        </span>
      </a>
      <div className="flex flex-none items-center gap-2">
        {site.phone && site.phoneHref && (
          <a
            href={site.phoneHref}
            aria-label={`Қўнғироқ қилиш: ${site.phone}`}
            className="inline-flex h-12 w-12 items-center justify-center gap-2 rounded-full bg-card font-bold text-ink shadow-[0_8px_16px_-12px_rgba(18,57,95,0.6)] sm:w-auto sm:px-4"
          >
            <PhoneIcon className="h-5 w-5 text-brand" />
            <span className="hidden whitespace-nowrap tabular-nums sm:inline">{site.phone}</span>
          </a>
        )}
        {/* Phones have the order bar at the bottom; here the button would crowd the name. */}
        <a
          href="#tez-buyurtma"
          className="hidden h-11 sm:inline-flex items-center rounded-full bg-brand px-3.5 text-[0.9rem] font-extrabold text-white sm:h-12 sm:px-5 sm:text-base shadow-[0_10px_18px_-10px_rgba(18,57,95,0.7)] transition-colors hover:bg-brand-2"
        >
          Консультация
        </a>
      </div>
    </header>
  );
}

/** The accent word, underlined by a single stroke of the pattern's blue. */
function Accent({ children }: { children: string }) {
  return (
    <span className="relative inline-block whitespace-nowrap text-brand">
      {children}
      <svg viewBox="0 0 300 20" preserveAspectRatio="none" className="absolute -bottom-[0.14em] left-0 h-[0.26em] w-full" aria-hidden="true">
        <path d="M4 13C60 5 128 4 186 8c42 3 78 4 110 0" fill="none" stroke="var(--pattern-soft)" strokeWidth="7" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/**
 * The three promises as piyolas set around the plate. On a phone they stand in one row of
 * three with the short wording, so the whole offer fits the first screen.
 */
function Cups({ className, row }: { className?: string; row?: boolean }) {
  return (
    <ul aria-label="Буюртма шартлари" className={className}>
      {product.hero.offer.map((o, i) => {
        const Icon = icons[o.icon];
        return (
          <li key={o.text} className={row ? 'flex flex-col items-center gap-2 text-center' : 'flex items-center gap-3.5'}>
            <span className={row ? 'piyola h-12 w-12 [&_svg]:h-5 [&_svg]:w-5' : 'piyola h-14 w-14'}>
              <Icon />
            </span>
            <span className={row ? 'text-[0.92rem] font-extrabold leading-tight text-ink' : 'text-[1.08rem] font-bold leading-snug text-ink'}>
              {row ? product.promises[i]?.title : o.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The first viewport is a table set from above: the words, the plate with the pack, and the
 * tray holding the order form. On a phone they follow one another in that order.
 */
export function Hero({
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
  const { hero } = product;
  return (
    <section id="asosiy" className="relative overflow-hidden bg-paper pb-14 sm:pb-20">
      <Header />
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-x-10 gap-y-8 px-4 pt-6 sm:px-6 sm:pt-12 lg:grid-cols-[1fr_minmax(0,24rem)] lg:pt-14 xl:grid-cols-[1.25fr_minmax(0,20rem)_minmax(0,24rem)] xl:items-start">
        <div className="min-w-0">
          <h1 className="text-[2.05rem] font-extrabold leading-[1.12] tracking-[-0.02em] text-ink text-balance sm:text-[2.9rem] xl:text-[2.55rem]">
            {hero.titleStart} <Accent>{hero.titleAccent}</Accent> {hero.titleEnd}
          </h1>
          {/* The same sentence opens the product section; a phone keeps its first screen for the offer. */}
          <p className="mt-5 hidden max-w-[36rem] text-[1.2rem] leading-relaxed text-ink-2 sm:block">{hero.sub}</p>
          <Cups className="mt-7 hidden space-y-4 xl:block" />
          {product.price !== null && (
            <p className="mt-6 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold tabular-nums">
                {formatPrice(product.price)} {product.currency}
              </span>
              {product.oldPrice !== null && <s className="text-xl text-muted tabular-nums">{formatPrice(product.oldPrice)}</s>}
            </p>
          )}
        </div>

        {/* On a phone the plate stays modest so the tray with the form follows within a screen. */}
        <div className="mx-auto w-full max-w-[12.5rem] sm:max-w-[20rem] lg:col-start-1 lg:row-start-2 xl:col-start-2 xl:row-start-1 xl:mt-10 xl:max-w-none">
          <PlateWithPack priority sizes="160px" />
        </div>

        <Cups row className="-mt-2 grid grid-cols-3 gap-2 sm:hidden" />
        <section id="tez-buyurtma" ref={sectionRef} aria-label="Буюртма формаси" className="min-w-0 lg:col-start-2 lg:row-span-3 lg:row-start-1 xl:col-start-3 xl:row-span-1">
          <div className="patnis paxta mx-auto max-w-[34rem]">
            <OrderForm utm={utm} variant="compact" completed={order} onSuccess={onOrdered} />
          </div>
        </section>
        <Cups className="hidden gap-4 sm:grid sm:grid-cols-3 sm:gap-3 lg:col-start-1 lg:row-start-3 xl:hidden sm:[&>li]:flex-col sm:[&>li]:text-center" />
      </div>
    </section>
  );
}

/**
 * The details behind the three cups, and the fourth promise (discreet packing), written as one
 * line along the edge of the cloth with a boll between the sentences, not as a row of tiles.
 */
export function Promises() {
  return (
    <section aria-label="Буюртма шартлари" className="bg-card">
      <Rim />
      {/* On a phone each sentence is its own line led by a boll; wider, one centred line. */}
      <p className="mx-auto max-w-5xl space-y-2.5 px-4 py-7 text-[1.08rem] font-semibold leading-relaxed text-ink-2 sm:space-y-0 sm:px-6 sm:text-center">
        {product.promises.map((p, i) => (
          <span key={p.title} className="flex items-start gap-2.5 sm:inline">
            <Boll open className={cn('mt-1 h-5 w-5 flex-none sm:mx-2 sm:mt-0 sm:inline-block sm:-translate-y-px sm:align-middle', i === 0 && 'sm:hidden')} />
            <span>
              {i === product.promises.length - 1 ? (
                <>
                  <strong className="font-extrabold text-ink">{p.title}:</strong> {p.text.toLowerCase()}
                </>
              ) : (
                p.text
              )}{' '}
            </span>
          </span>
        ))}
      </p>
      <Rim down />
    </section>
  );
}
