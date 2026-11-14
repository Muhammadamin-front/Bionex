// The main site: the original page (the one the partner site also shows) plus what makes it
// believable — real customers' video messages and the product's state certificate, right under
// the first form. Above it (2026-10-28) the form sat four phone screens down and orders all but
// stopped while the partner page kept getting them; back under it on 2026-10-29. The media live
// only on the Mac that deploys (.gitignore): the public repo never carries customers' faces. A
// missing file just leaves its part out.
import '@fontsource-variable/montserrat/wght.css';
import '../../styles.css';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Landing as Page } from '../../components/landing/Landing';
import { ConfirmAutofillContext } from '../../components/landing/OrderForm';
import { AskConcernContext, TelegramChannelContext } from '../../lib/concern';
import { ProductPhotoContext, type ProductPhoto } from '../../components/ui/ProductPack';
import { AdHero } from './AdHero';
import { Certificate, useNear } from './certificate';
import { MAIN_COPY } from './copy';
import { PageCopyContext } from '../../lib/copy';

const media = import.meta.glob<string>('./media/*.{mp4,jpg,webp}', { eager: true, query: '?url', import: 'default' });
const file = (name: string) => media[`./media/${name}`];
/** A picture: its WebP copy when there is one (2026-11-14: the covers and the certificate as JPEG were ~2× larger). */
const pic = (name: string) => file(`${name}.webp`) ?? file(`${name}.jpg`);

/**
 * In the order shown: the filmed stories with the box in hand first (vertical, `cover`), then the
 * Telegram video messages (square, `contain` keeps the round message whole).
 */
const videos = [
  { name: 'story-0', length: '0:46', fit: 'object-cover' },
  { name: 'story-1', length: '0:41', fit: 'object-cover' },
  { name: 'story-2', length: '1:48', fit: 'object-cover' },
  { name: 'story-3', length: '3:00', fit: 'object-cover' },
  { name: 'review-1', length: '1:00', fit: 'object-contain' },
  { name: 'review-2', length: '0:35', fit: 'object-contain' },
  { name: 'review-3', length: '0:36', fit: 'object-contain' },
]
  .map((v) => ({ ...v, src: file(`${v.name}.mp4`), poster: pic(v.name) }))
  .filter((v): v is typeof v & { src: string } => Boolean(v.src));
const certificate = { full: pic('certificate'), small: pic('certificate-small') };

/**
 * The owner's own photos of the box (2026-11-06; the sharp ones of ten, cropped and shrunk to WebP without
 * their metadata, see AGENTS.md #63). `name-<width>.webp` for each width; a missing file leaves the photo out.
 */
function photoSet(name: string, widths: number[]) {
  const files = widths.map((w) => file(`${name}-${w}.webp`));
  if (files.some((f) => !f)) return undefined;
  return {
    src: files[Math.min(1, files.length - 1)]!,
    srcSet: files.map((f, i) => `${f} ${widths[i]}w`).join(', '),
    full: files[files.length - 1]!,
  };
}
const front = photoSet('pack-front', [360, 540, 720]);
/** In place of the drawn pack in «Маҳсулот ҳақида» (its small print had spelling mistakes). */
const packPhoto: ProductPhoto | null = front
  ? { ...front, width: 720, height: 960, alt: 'Зейнара сиропи қадоғи, 330 мл', heroHiddenMedia: '(max-width: 1023px)' }
  : null;
const packPhotos = [
  { name: 'pack-angle', widths: [400, 600, 800], width: 800, height: 1067, alt: 'Зейнара қутиси ён томондан', caption: 'Зейнара сиропи, 330 мл', top: false },
  { name: 'pack-latin', widths: [400, 600, 800], width: 800, height: 1067, alt: 'Зейнара қутисининг лотин ёзувли тури', caption: 'Лотин ёзувли қадоғи', top: false },
  // Ingredients and how to take it: cut above the maker's address and phone.
  { name: 'pack-back', widths: [600, 1000], width: 1000, height: 1479, alt: 'Қути орқасидаги таркиб ва ичиш тартиби', caption: 'Таркиби ва ичиш тартиби (қути орқасида)', top: true },
]
  .map((p) => ({ ...p, set: photoSet(p.name, p.widths) }))
  .filter((p): p is typeof p & { set: NonNullable<typeof p.set> } => Boolean(p.set));

/**
 * The videos play by themselves once the row is on screen, one after another (owner, 2026-10-28):
 * with sound once the visitor has touched the page — browsers
 * allow sound only after that — else muted, with «Овозни ёқиш» to turn it on for the rest; after the last one it stops. Swiping to another video plays that one
 * and pauses the one before. Off the screen it pauses. Never on a data saver or for someone who
 * asked the phone for less motion.
 */

/** The page has had a tap or a key press, so a browser lets a video play with its sound. */
const touchedPage = () => {
  try {
    return Boolean((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive);
  } catch {
    return false;
  }
};

function VideoRow() {
  const [rowRef, near] = useNear<HTMLDivElement>();
  const refs = useRef<Array<HTMLVideoElement | null>>([]);
  const [current, setCurrent] = useState(0);
  const [sound, setSound] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [auto] = useState(() => {
    try {
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
      return !saveData && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const row = rowRef.current;
    if (!row || !auto || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOnScreen(Boolean(e && e.intersectionRatio >= 0.5)), { threshold: [0, 0.5] });
    io.observe(row);
    return () => io.disconnect();
  }, [auto]);

  // The current one plays while the row is on screen; every other one is paused.
  useEffect(() => {
    refs.current.forEach((v, i) => {
      if (!v) return;
      if (i !== current || !onScreen) {
        if (!v.paused) v.pause();
        return;
      }
      const withSound = sound || touchedPage();
      v.muted = !withSound;
      v.play()
        .then(() => withSound && setSound(true))
        .catch(() => {
          // Sound refused (an iPhone wants a tap on the video itself): carry on muted.
          if (!v.muted) {
            v.muted = true;
            setSound(false);
            v.play().catch(() => undefined);
          }
        });
    });
    // `sound` is read, not watched: turning it on must not restart the video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, onScreen]);

  // Swiped to another video (phones): that one plays, the one before pauses. Only where the row
  // scrolls sideways; on a wide screen every video is in view at once.
  useEffect(() => {
    const row = rowRef.current;
    if (!row || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (row.scrollWidth <= row.clientWidth) return;
        const seen = entries.filter((e) => e.isIntersecting && e.intersectionRatio >= 0.6).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const i = seen ? refs.current.findIndex((v) => v?.parentElement === seen.target) : -1;
        if (i >= 0) setCurrent(i);
      },
      { root: row, threshold: [0.6, 0.9] },
    );
    refs.current.forEach((v) => v?.parentElement && io.observe(v.parentElement));
    return () => io.disconnect();
  }, []);

  // Bring the playing one into the row's view (phones swipe sideways; the page itself never moves).
  useEffect(() => {
    const row = rowRef.current;
    const v = refs.current[current]?.parentElement;
    if (row && v && row.scrollWidth > row.clientWidth) row.scrollTo({ left: v.offsetLeft - row.offsetLeft - 16, behavior: 'smooth' });
  }, [current]);

  const turnSoundOn = () => {
    const v = refs.current[current];
    setSound(true);
    if (v) {
      v.muted = false;
      v.play().catch(() => undefined);
    }
  };

  return (
    <div ref={rowRef} className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0">
      {videos.map((v, i) => (
        <figure key={v.src} className="relative w-[78%] flex-none snap-center overflow-hidden rounded-3xl bg-card shadow-[0_18px_40px_-28px_rgba(13,58,39,0.45)] sm:w-auto">
          {/* preload="none": nothing is downloaded until it is its turn or someone presses play. */}
          <video
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={`block aspect-[3/4] w-full bg-ink ${v.fit}`}
            src={v.src}
            poster={near ? v.poster : undefined}
            controls
            playsInline
            muted
            preload="none"
            aria-label={`Мижоз фикри ${i + 1}`}
            onPlay={() => setCurrent(i)}
            onEnded={() => i === current && i + 1 < videos.length && setCurrent(i + 1)}
            onVolumeChange={(e) => i === current && setSound(!e.currentTarget.muted)}
          />
          {auto && i === current && onScreen && !sound && (
            <button
              type="button"
              onClick={turnSoundOn}
              className="absolute inset-x-0 top-1/2 mx-auto w-max -translate-y-1/2 rounded-full bg-ink/85 px-6 py-4 text-lg font-extrabold text-white shadow-lg backdrop-blur-sm"
            >
              🔊 Овозни ёқиш учун босинг
            </button>
          )}
          <figcaption className="px-5 py-3 text-[0.95rem] text-muted">Мижоз фикри · {v.length}</figcaption>
        </figure>
      ))}
    </div>
  );
}

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

/**
 * What the customers in the videos say, written out (owner, 2026-11-14: «videodagi mijozlarning review larini yozma
 * tarzda qo'shish»). Their own words, lightly shortened: Gulchehra opa's from the ad's captions; the others heard with
 * whisper.cpp (large-v3, on this Mac) and read back by the agent, so a word may be off — the owner checks them against
 * the videos. Names only where the video says them. Not the two Telegram video messages of the older men (review-2,
 * review-3): too unclear to write down without inventing words. No company name: the visitor never learns it (#16).
 */
const writtenReviews: Array<{ video: string; who: string; text: string }> = [
  {
    video: 'story-0',
    who: 'Гулчеҳра опа, 55 ёш',
    text: 'Тез чарчоқ, уйқусизлик мени безовта қиларди. Бир танишим менга Зейнара маҳсулотини тавсия қилди. Ҳозир ўзимни жуда яхши ҳис қиламан. Бунинг учун Зейнарага раҳмат!',
  },
  {
    video: 'story-2',
    who: 'Мижозимиз, 58 ёш',
    text: 'Қон босимим 180 га 100, 170 га 100 бўлиб юрардим, қанча касалхоналарда ётиб чиқдим. Юрак оғриқларим жуда кўп эди. Бир куни Instagram’да Зейнарани кўриб қолдим. Ичгандан бери анча яхшиман: босимим 140 га 100, 130 га 90 бўлди. Ҳолсизлик кетди, ўзимда куч сезяпман. Ҳаммага тавсия қиламан.',
  },
  {
    video: 'story-1',
    who: 'Мижозимиз, Сурхондарё вилояти',
    text: 'Бир неча ой олдин юрак уриши, қон босими, юракда безовталик, асабийлашиш пайдо бўлди. Бир неча шифокорга мурожаат қилиб, дори-дармон қилдим, лекин унча фойда кўрмадим. Instagram’да Зейнара рекламасини кўриб, харид қилдим ва ича бошладим. Яхши тарафга ўзгарди, раҳмат!',
  },
  {
    video: 'story-3',
    who: 'Мижозимиз, 65 ёш, Самарқанд вилояти',
    text: 'Қон босимим кўтарилиб, ҳолатим, кучим йўқ эди. Зейнарани эшитиб, аввал оламми-олмайми деб ўйландим. Бир ҳафтадан кейин фарқини сездим. Жуда яхши. Дугоналаримга ҳам тавсия қиламан, улар ҳам баҳра топсин.',
  },
  {
    video: 'review-1',
    who: 'Мижозимиз, Тошкент шаҳри',
    text: 'Тошкентдан буюртма қилиб олиб, ичяпман. Илгари нафас етишмасди, ентикиб қолардим, юриш ҳам қийин эди. Ҳозир юришда қийинчилик йўқ, анча ўзгариш бор. Фойдаси жуда-жуда зўр!',
  },
];

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

function Proof() {
  if (!videos.length && !certificate.full && !packPhotos.length) return null;
  return (
    <section aria-labelledby="ishonch-title" className="bg-paper-2">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        {videos.length > 0 && (
          <>
            <h2 id="ishonch-title" className="text-[1.8rem] font-extrabold leading-[1.15] tracking-[-0.02em] text-balance sm:text-[2.4rem]">
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
