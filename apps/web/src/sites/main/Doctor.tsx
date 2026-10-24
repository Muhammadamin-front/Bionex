import { QuoteMark } from '../../components/ui/Icons';
import { doctor } from './doctor-info';
import { SITE, Title } from './parts';

/**
 * The photo is picked up from photos/ if one is there; this build simply has none otherwise.
 * Kept inside the main site's tree so the partner build never carries it.
 */
const found = import.meta.glob('./photos/doctor.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' });
const photo = Object.values(found)[0] as string | undefined;

/** «Шифокор фикри»: the doctor's portrait in a porcelain frame with the paxta rim, and their words. */
export function Doctor() {
  if (!photo || !doctor.name.trim()) return null;
  return (
    <section aria-labelledby="shifokor-title" className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 py-16 sm:px-6 sm:py-24 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-14">
      <figure className="patnis paxta mx-auto w-full max-w-[22rem]">
        <img
          src={photo}
          alt={`${doctor.name}, ${doctor.title}`.replace(/, $/, '')}
          loading="lazy"
          decoding="async"
          className="block aspect-[3/4] w-full rounded-[1.6rem] bg-card object-cover object-top"
        />
      </figure>
      <div>
        <Title id="shifokor-title">Шифокор фикри</Title>
        {doctor.quote.length > 0 && (
          <blockquote className="mt-6">
            <QuoteMark className="h-8 w-auto text-accent-2" />
            {doctor.quote.map((q, i) => (
              <p key={i} className="mt-4 max-w-[60ch] text-[1.2rem] font-semibold leading-relaxed text-ink">
                {q}
              </p>
            ))}
          </blockquote>
        )}
        <p className="mt-6 text-xl font-extrabold text-ink">{doctor.name}</p>
        {doctor.title && <p className="mt-1 text-lg text-muted">{doctor.title}</p>}
        <p className="mt-1 text-lg font-bold text-brand-2">{SITE.full}</p>
      </div>
    </section>
  );
}
