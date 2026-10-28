// The main site: the original page (the one the partner site also shows) plus what makes it
// believable — real customers' video messages and the product's state certificate, right under
// the first form (above it since 2026-10-28). The media live only on the Mac that deploys (.gitignore): the public repo never
// carries customers' faces. A missing file just leaves its part out.
import '@fontsource-variable/montserrat/wght.css';
import '../../styles.css';
import { useEffect, useRef, useState } from 'react';
import { Landing as Page } from '../../components/landing/Landing';

const media = import.meta.glob<string>('./media/*.{mp4,jpg}', { eager: true, query: '?url', import: 'default' });
const file = (name: string) => media[`./media/${name}`];

/**
 * In the order shown: the filmed stories with the box in hand first (vertical, `cover`), then the
 * Telegram video messages (square, `contain` keeps the round message whole).
 */
const videos = [
  { name: 'story-1', length: '0:41', fit: 'object-cover' },
  { name: 'story-2', length: '1:48', fit: 'object-cover' },
  { name: 'story-3', length: '3:00', fit: 'object-cover' },
  { name: 'review-1', length: '1:00', fit: 'object-contain' },
  { name: 'review-2', length: '0:35', fit: 'object-contain' },
  { name: 'review-3', length: '0:36', fit: 'object-contain' },
]
  .map((v) => ({ ...v, src: file(`${v.name}.mp4`), poster: file(`${v.name}.jpg`) }))
  .filter((v): v is typeof v & { src: string } => Boolean(v.src));
const certificate = { full: file('certificate.jpg'), small: file('certificate-small.jpg') };

/**
 * The videos play by themselves once the row is on screen, one after another (owner, 2026-10-28):
 * with sound once the visitor has touched the page (closing the order dialog counts) — browsers
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
  const rowRef = useRef<HTMLDivElement>(null);
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
            poster={v.poster}
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

function Proof() {
  if (!videos.length && !certificate.full) return null;
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
            <p className="mt-5 text-[0.95rem] text-muted">Натижалар ҳар бир инсонда турлича бўлиши мумкин.</p>
          </>
        )}

        {certificate.full && (
          <figure className={`grid grid-cols-1 items-center gap-6 rounded-3xl bg-card p-6 shadow-[0_18px_40px_-28px_rgba(13,58,39,0.45)] sm:grid-cols-[12rem_1fr] sm:p-8 ${videos.length ? 'mt-10' : ''}`}>
            <a href={certificate.full} target="_blank" rel="noopener" className="mx-auto block w-40 sm:w-48">
              <img src={certificate.small ?? certificate.full} alt="Санитария-эпидемиологик хулоса № 482583" loading="lazy" className="w-full rounded-xl border border-line" />
            </a>
            <figcaption>
              <h3 className="font-display text-xl font-extrabold sm:text-2xl">Давлат текширувидан ўтган</h3>
              <p className="mt-3 text-lg leading-relaxed text-ink-2">
                Ўзбекистон Республикаси Соғлиқни сақлаш вазирлигининг санитария-эпидемиологик хулосаси № 482583: «Зейнара» сиропи
                хавфсизлик кўрсаткичлари бўйича санитария меъёрларига мос. 29.07.2028 гача амал қилади.
              </p>
              <a href={certificate.full} target="_blank" rel="noopener" className="mt-4 inline-block font-bold text-brand underline underline-offset-4">
                Ҳужжатни тўлиқ кўриш
              </a>
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}

export function Landing() {
  return <Page proof={<Proof />} />;
}
