// The main site: the original page (the one the partner site also shows) plus what makes it
// believable — real customers' video messages and the product's state certificate, right under
// the first form. Above it (2026-10-28) the form sat four phone screens down and orders all but
// stopped while the partner page kept getting them; back under it on 2026-10-29. The media live
// only on the Mac that deploys (.gitignore): the public repo never carries customers' faces. A
// missing file just leaves its part out.
import '@fontsource-variable/montserrat/wght.css';
import '../../styles.css';
import type { ReactNode } from 'react';
import { Landing as Page } from '../../components/landing/Landing';
import { ConfirmAutofillContext } from '../../components/landing/OrderForm';
import { AskConcernContext, TelegramChannelContext } from '../../lib/concern';
import { ProductPhotoContext, type ProductPhoto } from '../../components/ui/ProductPack';
import { AdHero } from './AdHero';
import { Certificate, useNear } from './certificate';
import { certificate, file, packPhotos, pic, photoSet, videos, writtenReviews } from './media';
import { VideoRow } from './video-row';
import { MAIN_COPY } from './copy';
import { CUSTOMERS, REPEAT_BUYERS } from './stats';
import { PageCopyContext } from '../../lib/copy';

const front = photoSet('pack-front', [360, 540, 720]);
/** In place of the drawn pack in «Маҳсулот ҳақида» (its small print had spelling mistakes). */
const packPhoto: ProductPhoto | null = front
  ? { ...front, width: 720, height: 960, alt: 'Зейнара сиропи қадоғи, 330 мл', heroHiddenMedia: '(max-width: 1023px)' }
  : null;
/** The real box, under the videos: fetched only near the screen, like everything else down here. */
function PackPhotos() {
  const [rowRef, near] = useNear<HTMLDivElement>();
  if (!packPhotos.length) return null;
  return (
    <div className="mt-12">
      <h3 className="font-display text-[1.5rem] font-extrabold leading-tight sm:text-[1.9rem]">Маҳсулотнинг ҳақиқий суратлари</h3>
      <p className="mt-2 max-w-2xl text-lg text-ink-2">Зейнара сизга шу қадоқда етказиб берилади.</p>
      <div ref={rowRef} className="-mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0">
        {packPhotos.map((p) => (
          <figure key={p.name} className="w-[70%] flex-none snap-center overflow-hidden rounded-3xl bg-card shadow-[0_18px_40px_-28px_rgba(13,58,39,0.45)] sm:w-auto">
            <a href={p.set.full} target="_blank" rel="noopener" className="block">
              <img
                src={near ? p.set.src : undefined}
                srcSet={near ? p.set.srcSet : undefined}
                sizes="(min-width: 640px) 33vw, 70vw"
                width={p.width}
                height={p.height}
                alt={p.alt}
                decoding="async"
                className={`block aspect-[3/4] h-auto w-full bg-paper-2 object-cover ${p.top ? 'object-top' : ''}`}
              />
            </a>
            <figcaption className="px-5 py-3 text-[0.95rem] text-muted">{p.caption}</figcaption>
          </figure>
        ))}
      </div>
      {packPhotos.length > 1 && <p className="mt-2 text-[0.95rem] text-muted sm:hidden">← Бошқа суратларни кўриш учун суринг →</p>}
    </div>
  );
}

/** The written reviews, each with its customer's face from the video (the cover), fetched only near the screen. */
function WrittenReviews() {
  const [ref, near] = useNear<HTMLDivElement>();
  // `face-<video>.webp`: a 120-px crop of the face from the video (story-0's is the first screen's); else the cover.
  const items = writtenReviews.map((r) => ({ ...r, face: pic(`face-${r.video}`) ?? pic(`${r.video}-face`) ?? pic(r.video) }));
  return (
    <div ref={ref} className="mt-12">
      <h3 className="font-display text-[1.5rem] font-extrabold leading-tight sm:text-[1.9rem]">Видеодаги мижозларимиз нима дейди</h3>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5">
        {items.map((r) => (
          <li key={r.video} className="flex flex-col rounded-3xl bg-card p-5 shadow-[0_18px_40px_-28px_rgba(13,58,39,0.45)] sm:p-6">
            <blockquote className="flex-1 text-[1.05rem] leading-relaxed text-ink">«{r.text}»</blockquote>
            <p className="mt-4 flex items-center gap-3 border-t border-line pt-4">
              {r.face && (
                <img
                  src={near ? r.face : undefined}
                  alt=""
                  width={48}
                  height={48}
                  decoding="async"
                  className="h-12 w-12 flex-none rounded-full bg-paper-2 object-cover"
                />
              )}
              <span className="font-display text-[1rem] font-bold text-ink">{r.who}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Two of the owner's figures, the first thing under the first screen (owner, 2026-11-14). */
function Stats() {
  const items = [
    { value: CUSTOMERS, label: 'мижозларимиз' },
    { value: REPEAT_BUYERS, label: 'мижозларимиз қайта харид қилади' },
  ];
  return (
    // A phone: one card under the other, each the full width (two side by side broke «400 000+» and «мижозларимиз» in two).
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5">
      {items.map((s) => (
        <li key={s.label} className="flex flex-col items-center rounded-3xl bg-card px-4 py-5 text-center shadow-[0_18px_40px_-28px_rgba(13,58,39,0.45)] sm:py-8">
          <span className="whitespace-nowrap font-display text-[2.2rem] font-extrabold leading-none tabular-nums text-brand sm:text-[2.8rem]">{s.value}</span>
          <span className="mt-2 text-[1.05rem] font-semibold leading-snug text-ink-2 sm:text-[1.15rem]">{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

function Proof() {
  if (!videos.length && !certificate.full && !packPhotos.length) return null;
  return (
    <section aria-labelledby="ishonch-title" className="bg-paper-2">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <Stats />
        {videos.length > 0 && (
          <>
            <h2 id="ishonch-title" className="mt-12 text-[1.8rem] font-extrabold leading-[1.15] tracking-[-0.02em] text-balance sm:text-[2.4rem]">
              Мижозларимиз ўз овози билан
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-ink-2">Зейнарани ичган мижозларимиз ўзлари айтиб беради.</p>
            <VideoRow />
            {videos.length > 1 && <p className="mt-2 text-[0.95rem] text-muted sm:hidden">← Бошқа видеоларни кўриш учун суринг →</p>}
            <WrittenReviews />
            <p className="mt-5 text-[0.95rem] text-muted">Натижалар ҳар бир инсонда турлича бўлиши мумкин.</p>
          </>
        )}

        <PackPhotos />

        {certificate.full && <Certificate full={certificate.full} small={certificate.small} spaced={videos.length > 0 || packPhotos.length > 0} />}
      </div>
    </section>
  );
}

/**
 * The ad's own video (Gulchehra opa) opens the page, with the first order form inside that first screen (2026-11-14);
 * without its files, the original first screen with the form under it.
 */
const ad = { video: file('story-0.mp4'), poster: pic('story-0'), face: pic('story-0-face') };
const { video: adVideo, poster: adPoster, face: adFace } = ad;
const adHero =
  adVideo && adPoster && adFace ? (form: ReactNode) => <AdHero video={adVideo} poster={adPoster} face={adFace} form={form} /> : undefined;

/*
 * No discount on the page any more (owner, 2026-11-06: «chegirma degan yozuvlarni butunlay olib tashlash kerak»).
 * It ran from 2026-10-30 as an OfferContext provider here (lib/offer.tsx: −25 %, pensioners −35 %, until 8 November);
 * without the provider every ticket, discount line and «… чегирма билан буюртма» button falls back to the plain text.
 */
export function Landing() {
  // The bottom bar hides over a form: it covered the submit button once the keyboard closed (2026-10-28).
  return (
    <>
      {/* «Сизни нима безовта қилади?» after the order (owner, 2026-10-30). */}
      <AskConcernContext.Provider value={true}>
        {/* After those questions the phone moves on to the Telegram channel (owner, 2026-11-05). */}
        <TelegramChannelContext.Provider value="https://t.me/zeynare">
          {/* An autofilled number is confirmed with one tap before the order goes (owner, 2026-11-01). */}
          <ConfirmAutofillContext.Provider value={true}>
            {/* No order dialog on arrival (2026-11-14): the first form is inside the first screen now, and the dialog
                (2 s after arrival, owner 2026-11-06) covered it with the same form and, as the page's largest paint,
                put PageSpeed's LCP at 3.6–5.8 s against 1.2 s without it. To bring it back: popupAfterMs={2000}
                in place of popup={false}. */}
            {/* The owner's photo of the box in place of the drawn pack (2026-11-06). */}
            <ProductPhotoContext.Provider value={packPhoto}>
              {/* A free specialist's consultation, not «буюртма»; the number read back before it goes (2026-11-14). */}
              <PageCopyContext.Provider value={MAIN_COPY}>
                <Page hero={adHero} proof={<Proof />} popup={false} barOverForms={false} />
              </PageCopyContext.Provider>
            </ProductPhotoContext.Provider>
          </ConfirmAutofillContext.Provider>
        </TelegramChannelContext.Provider>
      </AskConcernContext.Provider>
    </>
  );
}
