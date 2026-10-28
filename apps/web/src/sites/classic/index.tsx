// The main site: the original page (the one the partner site also shows) plus what makes it
// believable — real customers' video messages and the product's state certificate, right under
// the first form. The media live only on the Mac that deploys (.gitignore): the public repo never
// carries customers' faces. A missing file just leaves its part out.
import '@fontsource-variable/montserrat/wght.css';
import '../../styles.css';
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
            {/* On a phone one row to swipe through (six stacked videos would bury the rest of the
                page); from sm up a grid. */}
            <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0">
              {videos.map((v, i) => (
                <figure key={v.src} className="w-[78%] flex-none snap-center overflow-hidden rounded-3xl bg-card shadow-[0_18px_40px_-28px_rgba(13,58,39,0.45)] sm:w-auto">
                  {/* preload="none": nothing is downloaded until the visitor presses play. */}
                  <video className={`block aspect-[3/4] w-full bg-ink ${v.fit}`} src={v.src} poster={v.poster} controls playsInline preload="none" aria-label={`Мижоз фикри ${i + 1}`} />
                  <figcaption className="px-5 py-3 text-[0.95rem] text-muted">Мижоз фикри · {v.length}</figcaption>
                </figure>
              ))}
            </div>
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
