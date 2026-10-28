// The main site: the original page (the one the partner site also shows) plus what makes it
// believable — real customers' video messages and the product's state certificate, right under
// the first form. The media live only on the Mac that deploys (.gitignore): the public repo never
// carries customers' faces. A missing file just leaves its part out.
import '@fontsource-variable/montserrat/wght.css';
import '../../styles.css';
import { Landing as Page } from '../../components/landing/Landing';

const media = import.meta.glob<string>('./media/*.{mp4,jpg}', { eager: true, query: '?url', import: 'default' });
const file = (name: string) => media[`./media/${name}`];

const videos = [1, 2, 3]
  .map((n) => ({ src: file(`review-${n}.mp4`), poster: file(`review-${n}.jpg`) }))
  .filter((v): v is { src: string; poster: string | undefined } => Boolean(v.src));
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
            <p className="mt-3 max-w-2xl text-lg text-ink-2">Зейнарани ичган мижозларимиз Телеграм орқали юборган видео-хабарлар.</p>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
              {videos.map((v, i) => (
                <figure key={v.src} className="overflow-hidden rounded-3xl bg-card shadow-[0_18px_40px_-28px_rgba(13,58,39,0.45)]">
                  {/* preload="none": nothing is downloaded until the visitor presses play. */}
                  <video className="block aspect-square w-full bg-ink object-cover" src={v.src} poster={v.poster} controls playsInline preload="none" aria-label={`Мижоз фикри ${i + 1}`} />
                  <figcaption className="px-5 py-3 text-[0.95rem] text-muted">Мижоз фикри · видео-хабар</figcaption>
                </figure>
              ))}
            </div>
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
