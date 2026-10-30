import type { Utm } from '@bionex/shared/utm';
import { useState } from 'react';
import { formatPrice, product, site } from '../../config/product';
import { cn } from '../../lib/cn';
import { AntiMetalLink } from '../ui/AntiMetalButton';
import { AlertIcon, CheckIcon, PhoneIcon, QuoteMark } from '../ui/Icons';
import { ProductPack } from '../ui/ProductPack';
import { useOffer } from '../../lib/offer';
import { OrderForm, type OrderResult } from './OrderForm';

function Title({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <h2
      id={id}
      className={cn('text-[1.8rem] font-extrabold leading-[1.15] tracking-[-0.02em] text-balance sm:text-[2.4rem]', className)}
    >
      {children}
    </h2>
  );
}

function OrderButton({ children = 'Ҳозироқ буюртма бериш', className }: { children?: string; className?: string }) {
  return (
    <AntiMetalLink href="#forma" className={cn('w-full sm:w-auto', className)}>
      {children}
    </AntiMetalLink>
  );
}

const Tick = () => (
  <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-brand text-white" aria-hidden="true">
    <CheckIcon className="h-3.5 w-3.5" />
  </span>
);

export function Risks() {
  const { risks, stats } = product;
  const [lead, ...rest] = stats.items;
  return (
    <section id="xavf" aria-labelledby="xavf-title" className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div>
          <div className="mb-8 space-y-3 text-lg leading-relaxed text-ink-2">
            {product.hero.lead.map((p, i) =>
              'strong' in p ? (
                <p key={i} className="font-display text-xl font-bold leading-snug text-ink">
                  {p.strong}
                </p>
              ) : (
                <p key={i}>{p.text}</p>
              ),
            )}
          </div>
          <Title id="xavf-title">{risks.title}</Title>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">{risks.intro}</p>
        </div>
        <div>
          <div className="border-y border-line">
            {risks.items.map((r, i) => (
              <details key={r.title} className="faq-item border-b border-line last:border-b-0" open={i === 0}>
                <summary className="flex min-h-16 items-center justify-between gap-4 py-4 font-display text-xl font-bold">
                  <span className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 flex-none rounded-full bg-alarm" aria-hidden="true" />
                    {r.title}
                  </span>
                  <span className="faq-plus text-forest" aria-hidden="true" />
                </summary>
                <p className="max-w-[60ch] pb-5 pl-[1.4rem] text-lg leading-relaxed text-ink-2">{r.text}</p>
              </details>
            ))}
          </div>
          <p className="mt-5 text-lg font-semibold text-alarm">… {risks.outro}</p>
        </div>
      </div>

      {/* One dominant fact, two supporting facts set as text — not a row of metric cards. */}
      {lead && (
        <div className="mt-16 grid grid-cols-1 gap-8 border-t-2 border-forest pt-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <p>
            <span className="block font-display text-[3.4rem] font-extrabold leading-none tracking-[-0.035em] text-alarm tabular-nums sm:text-[5rem]">
              {lead.value}
            </span>
            <span className="mt-3 block max-w-md text-xl leading-snug">{lead.text}</span>
          </p>
          <div className="divide-y divide-line">
            {rest.map((s) => (
              <p key={s.value} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4 first:pt-0">
                <span className="min-w-24 flex-none font-display text-[2.2rem] font-extrabold leading-none text-forest tabular-nums">
                  {s.value}
                </span>
                <span className="text-lg leading-snug">{s.text}</span>
              </p>
            ))}
            <p className="pt-4 text-[0.95rem] text-muted">{stats.source}</p>
          </div>
        </div>
      )}
    </section>
  );
}

export function Expert() {
  const { expert, quote } = product;
  return (
    <section aria-label="Ибн Сино ўгити" className="bg-paper-2">
      {expert && (
        <div className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-8 px-4 pt-16 sm:px-6 md:grid-cols-[auto_1fr]">
          <img
            src={expert.photo.src}
            alt={expert.photo.alt}
            width={expert.photo.width}
            height={expert.photo.height}
            loading="lazy"
            className="mx-auto h-56 w-auto rounded-3xl object-cover"
          />
          <div>
            <h2 className="text-2xl font-extrabold">{expert.name}</h2>
            <p className="text-muted">{expert.title}</p>
            {expert.quote.map((q, i) => (
              <p key={i} className="mt-4 max-w-[62ch] text-lg leading-relaxed">
                {q}
              </p>
            ))}
          </div>
        </div>
      )}
      <figure className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <QuoteMark className="mx-auto h-10 w-auto text-accent-2" />
        <blockquote className="mt-6 font-display text-[1.75rem] font-extrabold leading-[1.2] tracking-[-0.015em] text-forest text-balance sm:text-[2.6rem]">
          {quote.text}
        </blockquote>
        <figcaption className="mt-5 text-lg text-muted">— {quote.author}</figcaption>
      </figure>
    </section>
  );
}

export function Symptoms() {
  const { symptoms, vesselImage } = product;
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <section id="alomatlar" aria-labelledby="alomat-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <Title id="alomat-title" className="max-w-3xl">
        {symptoms.title}
      </Title>
      <p className="mt-3 text-lg text-muted">{symptoms.hint}</p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1.35fr_0.65fr]">
        <ul className="grid grid-cols-1 content-start gap-3 sm:grid-cols-2">
          {symptoms.items.map((s, i) => {
            const on = picked.has(i);
            return (
              <li key={s}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(i)}
                  className={cn(
                    'flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[1.05rem] font-semibold transition-[border-color,background-color,box-shadow] duration-200',
                    on
                      ? 'border-alarm bg-alarm-bg shadow-[0_6px_16px_-10px_rgba(179,38,30,0.7)]'
                      : 'border-line bg-card hover:border-brand/60',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-7 w-7 flex-none place-items-center rounded-lg border-2 transition-colors duration-200',
                      on ? 'border-alarm bg-alarm text-white' : 'border-ink/35 bg-card text-transparent',
                    )}
                    aria-hidden="true"
                  >
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  {s}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-5">
          <figure className="text-center">
            <img
              src={vesselImage.src}
              alt={vesselImage.alt}
              width={vesselImage.width}
              height={vesselImage.height}
              loading="lazy"
              className="mx-auto h-auto w-full max-w-56 mix-blend-multiply"
            />
            <figcaption className="mx-auto mt-2 max-w-xs text-[0.95rem] leading-snug text-muted">{symptoms.vesselCaption}</figcaption>
          </figure>
          <div aria-live="polite" className="on-dark rounded-3xl bg-forest p-6 text-white">
            {picked.size > 0 ? (
              <>
                <p className="font-display text-2xl font-extrabold text-accent">Сиз {picked.size} та аломат белгиладингиз</p>
                <p className="mt-2 text-lg leading-relaxed text-on-forest">{symptoms.result}</p>
              </>
            ) : (
              <p className="text-lg leading-relaxed text-on-forest">
                Агар сизда ушбу аломатлардан камида биттаси бўлса — уни эътиборсиз қолдирманг!
              </p>
            )}
            <AntiMetalLink href="#tez-buyurtma" tone="accent" className="mt-5 w-full">
              Бепул маслаҳат олиш
            </AntiMetalLink>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The four stages read as one progression, so they sit on a single line — not in cards. */
export function Process() {
  const { process } = product;
  const last = process.steps.length - 1;
  return (
    <section aria-labelledby="jarayon-title" className="border-y border-line bg-card">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <Title id="jarayon-title">{process.title}</Title>
        <ol className="relative mt-10 grid grid-cols-1 gap-8 lg:grid-cols-4 lg:gap-6">
          <span aria-hidden="true" className="absolute bottom-6 left-[1.4rem] top-6 w-0.5 bg-line lg:inset-x-6 lg:bottom-auto lg:top-[1.4rem] lg:h-0.5 lg:w-auto" />
          {process.steps.map((s, i) => (
            <li key={s.title} className="relative flex gap-5 lg:block">
              <span
                className={cn(
                  'relative grid h-11 w-11 flex-none place-items-center rounded-full font-display text-lg font-extrabold ring-8 ring-card',
                  i === last ? 'bg-alarm text-white' : 'bg-forest text-accent',
                )}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div className="lg:mt-5">
                <h3 className={cn('text-xl font-bold', i === last && 'text-alarm')}>{s.title}</h3>
                <p className="mt-2 text-[1.05rem] leading-relaxed text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-12 max-w-3xl text-lg leading-relaxed">{process.note}</p>
      </div>
    </section>
  );
}

export function About() {
  const { about } = product;
  return (
    <section id="mahsulot" aria-labelledby="mahsulot-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="relative mx-auto w-full max-w-[17rem]">
          <div aria-hidden="true" className="absolute inset-x-[14%] bottom-[2%] h-[6%] rounded-[50%] bg-forest/35 blur-lg" />
          <ProductPack sizes="306px" imgClassName="drop-shadow-[0_22px_22px_rgba(13,58,39,0.3)]" />
        </div>
        <div>
          <Title id="mahsulot-title">{about.title}</Title>
          <p className="mt-4 max-w-[62ch] text-lg leading-relaxed">
            <strong className="font-display font-extrabold text-brand">{product.name.toUpperCase()}</strong> {about.description}
          </p>
          <h3 className="mt-8 text-xl font-bold">{about.benefitsTitle}</h3>
          <ul className="mt-4 space-y-3">
            {about.benefits.map((b) => (
              <li key={b} className="flex items-start gap-3 text-lg leading-snug">
                <Tick />
                {b}
              </li>
            ))}
          </ul>
          <dl className="mt-10 grid grid-cols-2 border-y border-line sm:grid-cols-4">
            {about.facts.map((f, i) => (
              <div
                key={f.label}
                className={cn('px-3 py-4 text-center', i % 2 === 1 && 'border-l border-line', i >= 2 && 'border-t border-line sm:border-t-0', i === 2 && 'sm:border-l')}
              >
                <dt className="font-display text-xl font-extrabold text-forest">{f.value}</dt>
                <dd className="text-[0.95rem] text-muted">{f.label}</dd>
              </div>
            ))}
          </dl>
          {product.price !== null && (
            <p className="mt-6 font-display text-3xl font-extrabold tabular-nums">
              {formatPrice(product.price)} {product.currency}
            </p>
          )}
          <OrderButton className="mt-8" />
        </div>
      </div>
    </section>
  );
}

/** Composition set like the printed label on the pack: one panel, ruled rows. */
export function Usage() {
  const { audience, dosage } = product;
  return (
    <section aria-label="Кимларга ва қандай қабул қилинади" className="bg-paper-2">
      <div className="mx-auto grid grid-cols-1 max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:gap-16">
        <div>
          <Title>{audience.title}</Title>
          <ul className="mt-6 space-y-3.5">
            {audience.items.map((a) => (
              <li key={a} className="flex items-start gap-3 text-lg leading-snug">
                <Tick />
                {a}
              </li>
            ))}
          </ul>
        </div>
        <div className="self-start rounded-3xl bg-card p-6 shadow-[0_18px_40px_-28px_rgba(13,58,39,0.45)] sm:p-8">
          <h2 className="text-2xl font-extrabold sm:text-[1.9rem]">{dosage.title}</h2>
          <dl className="mt-5 divide-y divide-line">
            {dosage.rows.map((r) => (
              <div key={r.who} className="py-4 first:pt-0">
                <dt className="font-display text-lg font-bold text-forest">{r.who}</dt>
                <dd className="mt-1 text-lg leading-relaxed">{r.how}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 flex items-start gap-3 rounded-2xl bg-accent/35 p-4 text-[1.05rem] font-medium leading-relaxed">
            <AlertIcon className="mt-0.5 h-6 w-6 flex-none text-forest" />
            {dosage.warning}
          </p>
        </div>
      </div>
    </section>
  );
}

export function Order({
  utm,
  orderRef,
  order,
  onOrdered,
}: {
  utm: Utm;
  orderRef: React.Ref<HTMLElement>;
  order: OrderResult | null;
  onOrdered: (r: OrderResult) => void;
}) {
  const { urgency, orderSteps } = product;
  return (
    <section id="forma" ref={orderRef} aria-labelledby="forma-title" className="on-dark bg-forest text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-start lg:gap-16">
        <div>
          <Title className="text-white">{urgency.title}</Title>
          <p className="mt-4 text-lg leading-relaxed text-on-forest">{urgency.intro}</p>
          <ul className="mt-5 space-y-2.5">
            {urgency.items.map((u) => (
              <li key={u} className="flex items-start gap-3 text-lg font-semibold">
                <span className="mt-2.5 h-2.5 w-2.5 flex-none rounded-full bg-accent" aria-hidden="true" />
                {u}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-lg leading-relaxed text-accent">{urgency.outro}</p>

          <h3 id="forma-title" className="mt-12 text-2xl font-extrabold">
            Буюртма бериш жуда осон
          </h3>
          <ol className="mt-5 space-y-4">
            {orderSteps.map((s, i) => (
              <li key={s} className="flex items-center gap-4 text-lg">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent font-display font-extrabold text-ink" aria-hidden="true">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
        <div className="min-w-0 text-ink [--focus-ring:var(--color-forest)]">
          <OrderForm utm={utm} completed={order} onSuccess={onOrdered} />
        </div>
      </div>
    </section>
  );
}

/** Social proof right before the order form: one featured story, the rest as a ruled grid. */
export function Reviews() {
  const [featured, ...rest] = product.reviews;
  if (!featured) return null;
  const Person = ({ name, meta, large }: { name: string; meta: string; large?: boolean }) => (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'grid flex-none place-items-center rounded-full bg-forest font-display font-extrabold text-accent',
          large ? 'h-14 w-14 text-2xl' : 'h-11 w-11 text-lg',
        )}
        aria-hidden="true"
      >
        {name.charAt(0)}
      </span>
      <div>
        <p className="font-display text-lg font-bold">{name}</p>
        <p className="text-[0.95rem] text-muted">{meta}</p>
      </div>
    </div>
  );
  return (
    <section aria-labelledby="fikr-title" className="bg-paper-2">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <Title id="fikr-title">Мижозларимиз фикрлари</Title>

        <figure className="mt-10 grid grid-cols-1 gap-6 rounded-3xl bg-card p-6 shadow-[0_18px_40px_-28px_rgba(13,58,39,0.45)] sm:p-10 lg:grid-cols-[auto_1fr] lg:gap-10">
          <QuoteMark className="h-9 w-auto text-accent-2" />
          <div>
            <blockquote className="font-display text-[1.35rem] font-semibold leading-[1.45] text-ink sm:text-[1.6rem]">
              {featured.text}
            </blockquote>
            <figcaption className="mt-6">
              <Person name={featured.name} meta={featured.meta} large />
            </figcaption>
          </div>
        </figure>

        <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-3xl bg-line md:grid-cols-2">
          {rest.map((r) => (
            <figure key={r.name} className="flex flex-col justify-between gap-5 bg-card p-6 sm:p-8">
              <blockquote className="text-lg leading-relaxed text-ink-2">{r.text}</blockquote>
              <figcaption>
                <Person name={r.name} meta={r.meta} />
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-5 text-[0.95rem] text-muted">Натижалар ҳар бир инсонда турлича бўлиши мумкин.</p>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section aria-labelledby="savol-title" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <Title id="savol-title">Кўп бериладиган саволлар</Title>
      <div className="mt-8 border-y border-line">
        {product.faq.map((item) => (
          <details key={item.q} className="faq-item border-b border-line last:border-b-0">
            <summary className="flex min-h-16 items-center justify-between gap-4 py-5 text-left font-display text-lg font-bold">
              {item.q}
              <span className="faq-plus text-forest" aria-hidden="true" />
            </summary>
            <p className="max-w-[62ch] pb-6 text-lg leading-relaxed text-ink-2">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Family() {
  const { family, familyImage } = product;
  return (
    <section aria-labelledby="oila-title" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="grid grid-cols-1 items-end overflow-hidden rounded-[2rem] bg-card shadow-[0_24px_60px_-40px_rgba(13,58,39,0.6)] md:grid-cols-2">
        <img
          src={familyImage.src}
          alt={familyImage.alt}
          width={familyImage.width}
          height={familyImage.height}
          loading="lazy"
          className="h-full max-h-[22rem] w-full object-cover object-top md:max-h-none"
        />
        <div className="self-center p-6 sm:p-10">
          <h2 id="oila-title" className="text-[1.8rem] font-extrabold leading-[1.15] tracking-[-0.02em] text-balance sm:text-[2.4rem]">
            {family.title}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">{family.text}</p>
          <OrderButton className="mt-8" />
          <p className="mt-4 flex items-center gap-2 font-semibold text-brand-2">
            <CheckIcon className="h-5 w-5 flex-none" />
            Олдиндан тўлов йўқ. Кўриб, кейин тўлайсиз.
          </p>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="on-dark bg-forest text-on-forest">
      {/* Extra bottom room on phones so the last links can scroll clear of the fixed order bar. */}
      <div className="mx-auto max-w-6xl px-4 pb-32 pt-10 sm:px-6 md:pb-10">
        <div className="flex flex-col gap-4 text-[0.95rem] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.legalName}. Барча ҳуқуқлар ҳимояланган.
          </p>
          {site.phone && site.phoneHref && (
            <a href={site.phoneHref} className="inline-flex min-h-11 items-center gap-2 font-display text-lg font-bold text-white tabular-nums">
              <PhoneIcon className="h-5 w-5 text-accent" />
              {site.phone}
            </a>
          )}
          <nav aria-label="Пастки меню" className="flex flex-wrap gap-x-6">
            {[
              ['#mahsulot', 'Маҳсулот'],
              ['#alomatlar', 'Аломатлар'],
              ['#forma', 'Бепул консультация'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="inline-flex min-h-11 items-center rounded underline-offset-4 hover:text-white hover:underline">
                {label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

export function StickyCta({ visible, quickFormOnScreen }: { visible: boolean; quickFormOnScreen: boolean }) {
  const offer = useOffer();
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-12px_28px_-18px_rgba(13,58,39,0.55)] transition-transform duration-300 ease-out md:hidden"
      style={{ transform: visible ? 'translate3d(0,0,0)' : 'translate3d(0,110%,0)' }}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3">
        {site.phoneHref && (
          <a
            href={site.phoneHref}
            tabIndex={visible ? 0 : -1}
            aria-label={`Қўнғироқ қилиш: ${site.phone}`}
            className="grid h-16 w-16 flex-none place-items-center rounded-2xl border-2 border-forest/25 text-forest"
          >
            <PhoneIcon className="h-6 w-6" />
          </a>
        )}
        {/* A plain solid button here: it must always fit next to the call button on 320 px phones. */}
        <a
          href="#forma"
          onClick={(e) => {
            // The nearest form, not the last one: until the visitor has scrolled past the first
            // form, go there. The bottom form is ~14 screens down on a phone, and a smooth
            // scroll that long stops halfway as soon as a finger touches the screen.
            const quick = document.getElementById('tez-buyurtma');
            if (!quick || quick.getBoundingClientRect().bottom <= 0) return;
            e.preventDefault();
            const heroName = quickFormOnScreen ? quick.querySelector<HTMLInputElement>('form input[name=zn-customer]') : null;
            if (heroName) {
              heroName.scrollIntoView({ block: 'center', behavior: 'smooth' });
              heroName.focus({ preventScroll: true });
            } else {
              quick.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }
          }}
          tabIndex={visible ? 0 : -1}
          className="inline-flex h-16 min-w-0 flex-1 items-center justify-center rounded-2xl bg-forest px-4 font-display text-[1.05rem] font-bold text-white shadow-[0_10px_24px_-10px_rgba(13,58,39,0.6)] active:scale-[0.98]"
        >
          {offer ? `−${offer.percent}% чегирма билан буюртма` : 'Бепул консультация'}
        </a>
      </div>
    </div>
  );
}
