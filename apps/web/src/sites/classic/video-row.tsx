// The customers' videos in one row that plays by itself (owner, 2026-10-28), shared by the main site's two pages.
// The poster page (../plakat) passes its own classes; zeynara.com.uz uses the defaults.
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useNear } from './certificate';
import { videos } from './media';

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

/** Classes for the row's parts; each default is zeynara.com.uz's own look. */
export interface VideoRowLook {
  row?: string;
  frame?: string;
  video?: string;
  sound?: string;
  caption?: string;
  /** What the «turn the sound on» button says (zeynara.com.uz: an emoji and the words). */
  soundLabel?: ReactNode;
}

const DEFAULT_LOOK: Required<VideoRowLook> = {
  row: '-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0',
  frame: 'relative w-[78%] flex-none snap-center overflow-hidden rounded-3xl bg-card shadow-[0_18px_40px_-28px_rgba(13,58,39,0.45)] sm:w-auto',
  video: 'block aspect-[3/4] w-full bg-ink',
  sound: 'absolute inset-x-0 top-1/2 mx-auto w-max -translate-y-1/2 rounded-full bg-ink/85 px-6 py-4 text-lg font-extrabold text-white shadow-lg backdrop-blur-sm',
  caption: 'px-5 py-3 text-[0.95rem] text-muted',
  soundLabel: '🔊 Овозни ёқиш учун босинг',
};

export function VideoRow({ look = {} }: { look?: VideoRowLook } = {}) {
  const l = { ...DEFAULT_LOOK, ...look };
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
    <div ref={rowRef} className={l.row}>
      {videos.map((v, i) => (
        <figure key={v.src} className={l.frame}>
          {/* preload="none": nothing is downloaded until it is its turn or someone presses play. */}
          <video
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={`${l.video} ${v.fit}`}
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
              className={l.sound}
            >
              {l.soundLabel}
            </button>
          )}
          <figcaption className={l.caption}>Мижоз фикри · {v.length}</figcaption>
        </figure>
      ))}
    </div>
  );
}

