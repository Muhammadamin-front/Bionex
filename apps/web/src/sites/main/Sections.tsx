import type { Utm } from '@bionex/shared/utm';
import { useState } from 'react';
import { formatPrice, product, site } from '../../config/product';
import { cn } from '../../lib/cn';
import { OrderForm, type OrderResult } from '../../components/landing/OrderForm';
import { AntiMetalLink } from '../../components/ui/AntiMetalButton';
import { AlertIcon, PhoneIcon, QuoteMark } from '../../components/ui/Icons';
import { ProductPack } from '../../components/ui/ProductPack';
import { Boll, BollTick, Mark, Rim, SITE, Title } from './parts';

const shell = 'mx-auto max-w-6xl px-4 sm:px-6';

function OrderButton({ children = 'Ҳозироқ буюртма бериш', className }: { children?: string; className?: string }) {
  return (
    <AntiMetalLink href="#forma" className={cn('w-full sm:w-auto', className)}>
      {children}
    </AntiMetalLink>
  );
}

/** Ticking a symptom opens a cotton boll beside it. */
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
    <section id="alomatlar" aria-labelledby="alomat-title" className={cn(shell, 'py-16 sm:py-24')}>
      <Title id="alomat-title" className="max-w-3xl">
        {symptoms.title}
      </Title>
      <p className="mt-3 text-lg text-muted">{symptoms.hint}</p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_0.6fr]">
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
                    'flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[1.06rem] font-bold transition-[border-color,background-color,box-shadow] duration-200',
                    on
                      ? 'border-brand bg-card shadow-[0_10px_20px_-14px_rgba(18,57,95,0.8)]'
                      : 'border-line bg-card/70 hover:border-accent-2 hover:bg-card',
                  )}
                >
                  <span className={cn('grid h-9 w-9 flex-none place-items-center rounded-full border-2 transition-colors', on ? 'border-transparent' : 'border-accent-2')}>
                    <Boll open={on} className="h-9 w-9" />
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
              className="mx-auto h-auto w-full max-w-52 mix-blend-multiply"
            />
            <figcaption className="mx-auto mt-2 max-w-xs text-[0.98rem] leading-snug text-muted">{symptoms.vesselCaption}</figcaption>
          </figure>
          <div aria-live="polite" className="on-dark rounded-[1.75rem] bg-brand p-6 text-white shadow-[0_24px_40px_-28px_rgba(18,57,95,0.9)]">
            {picked.size > 0 ? (
              <>
                <p className="text-2xl font-extrabold">Сиз {picked.size} та аломат белгиладингиз</p>
                <p className="mt-2 text-lg leading-relaxed text-on-forest">{symptoms.result}</p>
              </>
            ) : (
              <p className="text-lg leading-relaxed text-on-forest">Агар сизда ушбу аломатлардан камида биттаси бўлса — уни эътиборсиз қолдирманг!</p>
            )}
            <a
              href="#tez-buyurtma"
              className="mt-5 flex h-16 w-full items-center justify-center rounded-2xl bg-card px-4 text-[1.08rem] font-extrabold text-brand-2 shadow-[0_10px_18px_-12px_rgba(0,0,0,0.5)] transition-colors hover:bg-paper"
            >
              Бепул маслаҳат олиш
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Risks() {
  const { risks, stats } = product;
  const [lead, ...rest] = stats.items;
  return (
    <section id="xavf" aria-labelledby="xavf-title" className="bg-card">
      <Rim />
      <div className={cn(shell, 'py-16 sm:py-24')}>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <div className="mb-8 space-y-3 text-lg leading-relaxed text-ink-2">
              {product.hero.lead.map((p, i) =>
                'strong' in p ? (
                  <p key={i} className="text-xl font-extrabold leading-snug text-ink">
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
            <div className="border-y-2 border-line">
              {risks.items.map((r, i) => (
                <details key={r.title} className="faq-item border-b border-line last:border-b-0" open={i === 0}>
                  <summary className="flex min-h-16 items-center justify-between gap-4 py-4 text-xl font-extrabold text-ink">
                    <span className="flex items-center gap-3">
                      <span className="h-3 w-3 flex-none rotate-45 rounded-[3px] bg-brand" aria-hidden="true" />
                      {r.title}
                    </span>
                    <span className="faq-plus text-brand" aria-hidden="true" />
                  </summary>
                  <p className="max-w-[60ch] pb-5 pl-[1.5rem] text-lg leading-relaxed text-ink-2">{r.text}</p>
                </details>
              ))}
            </div>
            <p className="mt-5 text-lg font-bold text-ink">… {risks.outro}</p>
          </div>
        </div>

        {/* The figures are told as sentences, the way a person would say them at the table. */}
        {lead && (
          <div className="mt-16 max-w-4xl border-t-2 border-line pt-10">
            <p className="text-[1.45rem] font-semibold leading-[1.55] text-ink sm:text-[1.75rem]">
              <strong className="font-black text-brand tabular-nums">{lead.value}</strong> {lead.text}.{' '}
              {rest.map((s) => (
                <span key={s.value}>
                  <strong className="font-black text-brand tabular-nums">{s.value}</strong> {s.text}.{' '}
                </span>
              ))}
            </p>
            <p className="mt-4 text-[0.95rem] text-muted">{stats.source}</p>
          </div>
        )}
      </div>
      <Rim down />
    </section>
  );
}

/** Four stages poured like four piyolas, in order. */
export function Process() {
  const { process } = product;
  return (
    <section aria-labelledby="jarayon-title" className={cn(shell, 'py-16 sm:py-24')}>
      <Title id="jarayon-title">{process.title}</Title>
      <ol className="relative mt-10 grid grid-cols-1 gap-8 lg:grid-cols-4 lg:gap-6">
        <span aria-hidden="true" className="absolute bottom-8 left-8 top-8 w-0 border-l-2 border-dashed border-accent-2 lg:inset-x-8 lg:bottom-auto lg:top-8 lg:h-0 lg:w-auto lg:border-l-0 lg:border-t-2" />
        {process.steps.map((s, i) => (
          <li key={s.title} className="relative flex gap-5 lg:block">
            <span className="piyola h-16 w-16 text-2xl font-black text-brand-2" aria-hidden="true">
              <span>{i + 1}</span>
            </span>
            <div className="lg:mt-5">
              <h3 className="text-xl font-extrabold text-ink">{s.title}</h3>
              <p className="mt-2 text-[1.06rem] leading-relaxed text-muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-12 max-w-3xl text-lg leading-relaxed text-ink-2">{process.note}</p>
    </section>
  );
}

export function About() {
  const { about } = product;
  return (
    <section id="mahsulot" aria-labelledby="mahsulot-title" className="paxta">
      <div className="mx-auto max-w-6xl px-3 py-16 sm:px-6 sm:py-24">
        <div className="grid grid-cols-1 items-center gap-10 rounded-[2.25rem] bg-card p-6 shadow-[0_30px_50px_-36px_rgba(18,57,95,0.7)] outline outline-[3px] -outline-offset-[3px] outline-brand max-sm:px-4 sm:p-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-14">
          <div className="relative mx-auto w-full max-w-[15rem]">
            <div aria-hidden="true" className="absolute inset-x-[14%] bottom-[2%] h-[6%] rounded-[50%] bg-[rgba(18,57,95,0.3)] blur-lg" />
            <ProductPack sizes="270px" imgClassName="drop-shadow-[0_22px_22px_rgba(18,57,95,0.3)]" />
          </div>
          <div>
            <Title id="mahsulot-title">{about.title}</Title>
            <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-ink-2">
              <strong className="font-black text-brand">{product.name.toUpperCase()}</strong> {about.description}
            </p>
            <h3 className="mt-8 text-xl font-extrabold text-ink">{about.benefitsTitle}</h3>
            <ul className="mt-4 space-y-3">
              {about.benefits.map((b) => (
                <li key={b} className="flex items-start gap-3 text-lg leading-snug text-ink">
                  <BollTick />
                  {b}
                </li>
              ))}
            </ul>
            <dl className="mt-10 grid grid-cols-1 gap-x-6 gap-y-2 border-y-2 border-line py-4 sm:grid-cols-2">
              {about.facts.map((f) => (
                <div key={f.label} className="flex items-baseline gap-1.5 whitespace-nowrap">
                  <dt className="text-lg font-black text-brand-2">{f.value}</dt>
                  <dd className="text-base text-muted">{f.label}</dd>
                </div>
              ))}
            </dl>
            {product.price !== null && (
              <p className="mt-6 text-3xl font-black tabular-nums">
                {formatPrice(product.price)} {product.currency}
              </p>
            )}
            <OrderButton className="mt-8" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function Usage() {
  const { audience, dosage } = product;
  return (
    <section aria-label="Кимларга ва қандай қабул қилинади" className={cn(shell, 'grid grid-cols-1 gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16')}>
      <div>
        <Title>{audience.title}</Title>
        <ul className="mt-6 space-y-3.5">
          {audience.items.map((a) => (
            <li key={a} className="flex items-start gap-3 text-lg leading-snug text-ink">
              <BollTick />
              {a}
            </li>
          ))}
        </ul>
      </div>
      <div className="self-start overflow-hidden rounded-[2rem] bg-card shadow-[0_24px_44px_-32px_rgba(18,57,95,0.7)]">
        <Rim />
        <div className="p-6 sm:p-8">
          <h2 className="text-2xl font-extrabold text-ink sm:text-[1.95rem]">{dosage.title}</h2>
          <dl className="mt-5 divide-y divide-line">
            {dosage.rows.map((r) => (
              <div key={r.who} className="py-4 first:pt-0">
                <dt className="text-lg font-extrabold text-brand-2">{r.who}</dt>
                <dd className="mt-1 text-lg leading-relaxed text-ink">{r.how}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 flex items-start gap-3 rounded-2xl bg-paper p-4 text-[1.05rem] font-semibold leading-relaxed text-ink">
            <AlertIcon className="mt-0.5 h-6 w-6 flex-none text-brand" />
            {dosage.warning}
          </p>
        </div>
      </div>
    </section>
  );
}

/** Social proof right before the order form: one story served on a plate, the rest beside it. */
export function Reviews() {
  const [featured, ...rest] = product.reviews;
  if (!featured) return null;
  const Person = ({ name, meta, large }: { name: string; meta: string; large?: boolean }) => (
    <div className="flex items-center gap-3">
      <span className={cn('piyola font-black text-brand-2', large ? 'h-16 w-16 text-2xl' : 'h-12 w-12 text-lg')} aria-hidden="true">
        <span>{name.charAt(0)}</span>
      </span>
      <div>
        <p className="text-lg font-extrabold text-ink">{name}</p>
        <p className="text-[0.95rem] text-muted">{meta}</p>
      </div>
    </div>
  );
  return (
    <section aria-labelledby="fikr-title" className="bg-paper-2">
      <div className={cn(shell, 'py-16 sm:py-24')}>
        <Title id="fikr-title">Мижозларимиз фикрлари</Title>
        <figure className="mt-10 grid grid-cols-1 gap-6 rounded-[2rem] bg-card p-6 shadow-[0_24px_44px_-32px_rgba(18,57,95,0.7)] sm:p-10 lg:grid-cols-[auto_1fr] lg:gap-10">
          <QuoteMark className="h-9 w-auto text-accent-2" />
          <div>
            <blockquote className="text-[1.35rem] font-bold leading-[1.5] text-ink sm:text-[1.6rem]">{featured.text}</blockquote>
            <figcaption className="mt-6">
              <Person name={featured.name} meta={featured.meta} large />
            </figcaption>
          </div>
        </figure>
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {rest.map((r) => (
            <figure key={r.name} className="flex flex-col justify-between gap-5 rounded-[1.75rem] bg-card/80 p-6 sm:p-8">
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

export function Quote() {
  const { quote } = product;
  return (
    <figure className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
      <QuoteMark className="mx-auto h-10 w-auto text-accent-2" />
      <blockquote className="mt-6 text-[1.75rem] font-extrabold leading-[1.25] tracking-[-0.01em] text-brand-2 text-balance sm:text-[2.5rem]">{quote.text}</blockquote>
      <figcaption className="mt-5 text-lg text-muted">— {quote.author}</figcaption>
    </figure>
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
    <section id="forma" ref={orderRef} aria-labelledby="forma-title" className="bg-card">
      <Rim />
      <div className={cn(shell, 'grid grid-cols-1 gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:items-start lg:gap-16')}>
        <div>
          <Title>{urgency.title}</Title>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">{urgency.intro}</p>
          <ul className="mt-5 space-y-2.5">
            {urgency.items.map((u) => (
              <li key={u} className="flex items-start gap-3 text-lg font-bold text-ink">
                <span className="mt-2 h-3 w-3 flex-none rotate-45 rounded-[3px] bg-brand" aria-hidden="true" />
                {u}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-lg font-semibold leading-relaxed text-brand-2">{urgency.outro}</p>

          <h3 id="forma-title" className="mt-12 text-2xl font-extrabold text-ink">
            Буюртма бериш жуда осон
          </h3>
          <ol className="mt-5 space-y-4">
            {orderSteps.map((s, i) => (
              <li key={s} className="flex items-center gap-4 text-lg text-ink">
                <span className="piyola h-12 w-12 text-lg font-black" aria-hidden="true">
                  <span>{i + 1}</span>
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
        <div className="patnis paxta min-w-0">
          <OrderForm utm={utm} completed={order} onSuccess={onOrdered} />
        </div>
      </div>
      <Rim down />
    </section>
  );
}

export function Faq() {
  return (
    <section aria-labelledby="savol-title" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <Title id="savol-title">Кўп бериладиган саволлар</Title>
      <div className="mt-8 border-y-2 border-line">
        {product.faq.map((item) => (
          <details key={item.q} className="faq-item border-b border-line last:border-b-0">
            <summary className="flex min-h-16 items-center justify-between gap-4 py-5 text-left text-lg font-extrabold text-ink">
              {item.q}
              <span className="faq-plus text-brand" aria-hidden="true" />
            </summary>
            <p className="max-w-[62ch] pb-6 text-lg leading-relaxed text-ink-2">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** The family, served in the round: the photo set inside a patterned lagan. */
export function Family() {
  const { family, familyImage } = product;
  return (
    <section aria-labelledby="oila-title" className={cn(shell, 'grid grid-cols-1 items-center gap-10 pb-16 sm:pb-24 md:grid-cols-[minmax(0,26rem)_1fr] md:gap-14')}>
      <div className="lagan mx-auto w-full max-w-[22rem] md:max-w-none">
        <img
          src={familyImage.src}
          alt={familyImage.alt}
          width={familyImage.width}
          height={familyImage.height}
          loading="lazy"
          className="absolute inset-[13.5%] h-[73%] w-[73%] rounded-full object-cover object-top"
        />
        <span className="lagan__ring" aria-hidden="true" />
        <span className="lagan__line lagan__line--outer" aria-hidden="true" />
        <span className="lagan__line lagan__line--inner" aria-hidden="true" />
      </div>
      <div>
        <h2 id="oila-title" className="text-[1.85rem] font-extrabold leading-[1.15] tracking-[-0.015em] text-ink text-balance sm:text-[2.5rem]">
          {family.title}
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted">{family.text}</p>
        <OrderButton className="mt-8" />
        <p className="mt-4 flex items-center gap-2 font-bold text-brand-2">
          <BollTick className="mt-0 h-6 w-6" />
          Олдиндан тўлов йўқ. Кўриб, кейин тўлайсиз.
        </p>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-card">
      <Rim />
      {/* Extra bottom room on phones so the last links can scroll clear of the fixed order bar. */}
      <div className={cn(shell, 'flex flex-col gap-5 pb-32 pt-8 text-[0.98rem] text-muted md:flex-row md:items-center md:justify-between md:pb-10')}>
        <p className="flex items-center gap-3">
          <Mark className="h-10 w-10 flex-none" />
          <span>
            <span className="block font-extrabold text-ink">{SITE.full}</span>© {new Date().getFullYear()}. Барча ҳуқуқлар ҳимояланган.
          </span>
        </p>
        {site.phone && site.phoneHref && (
          <a href={site.phoneHref} className="inline-flex min-h-11 items-center gap-2 text-lg font-extrabold text-ink tabular-nums">
            <PhoneIcon className="h-5 w-5 text-brand" />
            {site.phone}
          </a>
        )}
        <nav aria-label="Пастки меню" className="flex flex-wrap gap-x-6">
          {[
            ['#mahsulot', 'Маҳсулот'],
            ['#alomatlar', 'Аломатлар'],
            ['#forma', 'Бепул консультация'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="inline-flex min-h-11 items-center rounded font-bold text-brand-2 underline-offset-4 hover:underline">
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export function StickyCta({ visible, quickFormOnScreen }: { visible: boolean; quickFormOnScreen: boolean }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 bg-card px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-14px_28px_-18px_rgba(18,57,95,0.6)] transition-transform duration-300 ease-out md:hidden"
      style={{ transform: visible ? 'translate3d(0,0,0)' : 'translate3d(0,110%,0)' }}
      aria-hidden={!visible}
    >
      <Rim className="absolute inset-x-0 top-0 -translate-y-full" />
      <div className="flex items-center gap-3">
        {site.phoneHref && (
          <a
            href={site.phoneHref}
            tabIndex={visible ? 0 : -1}
            aria-label={`Қўнғироқ қилиш: ${site.phone}`}
            className="grid h-16 w-16 flex-none place-items-center rounded-2xl border-2 border-line text-brand"
          >
            <PhoneIcon className="h-6 w-6" />
          </a>
        )}
        <a
          href="#forma"
          onClick={(e) => {
            // The nearest form, not the last one (see the partner page's StickyCta).
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
          className="inline-flex h-16 min-w-0 flex-1 items-center justify-center rounded-2xl bg-brand px-4 text-[1.08rem] font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(18,57,95,0.7)] active:scale-[0.98]"
        >
          Бепул консультация
        </a>
      </div>
    </div>
  );
}
