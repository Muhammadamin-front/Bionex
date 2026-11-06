import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { product } from '../../config/product';
import { cn } from '../../lib/cn';
import { useInView } from '../../lib/in-view';

/**
 * The Zeynara pack with its printed heart beating.
 *
 * A cut-out of the heart (alpha matte taken from the photo itself) sits exactly over
 * the printed heart, so at rest it is invisible; on each beat it swells by a few
 * percent and a warm glow pulses behind it. Only transform/opacity animate.
 *
 * It beats a few times when the pack comes into view and again when touched or hovered,
 * then rests: endless motion would fail WCAG 2.2.2 and distract older readers.
 */
type PackProps = {
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  /** Rendered width hint for picking the right file from srcSet. */
  sizes: string;
};

/** A real photo of the box. */
export interface ProductPhoto {
  src: string;
  srcSet: string;
  width: number;
  height: number;
  alt: string;
  /**
   * Where the first screen's copy (`priority`) is not shown at all: there a 1-pixel image stands in, so
   * phones do not download a picture they never see (the main site's first screen shows the pack from
   * 1024 px only).
   */
  heroHiddenMedia?: string;
}

const NOTHING = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * The main site shows the owner's own photo of the box in place of the drawn pack (sites/classic,
 * 2026-11-06: the drawing's small print had spelling mistakes; a real box is more believable). The
 * partner site provides nothing and keeps the drawing with its beating heart.
 */
export const ProductPhotoContext = createContext<ProductPhoto | null>(null);

export function ProductPack(props: PackProps) {
  const photo = useContext(ProductPhotoContext);
  return photo ? <PackPhoto photo={photo} {...props} /> : <DrawnPack {...props} />;
}

/** The photo gets its address only near the screen and after the page is taken over: on a slow phone the
 *  script that makes the form work comes first (see sites/classic `useNear`). */
function PackPhoto({ photo, className, imgClassName, priority = false, sizes }: PackProps & { photo: ProductPhoto }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(priority);
  useEffect(() => {
    const el = ref.current;
    if (near || !el) return;
    if (typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setNear(true), { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const img = (
    <img
      src={near ? photo.src : undefined}
      srcSet={near ? photo.srcSet : undefined}
      sizes={sizes}
      alt={photo.alt}
      width={photo.width}
      height={photo.height}
      decoding="async"
      className={cn('relative block h-auto w-full rounded-3xl bg-paper-2', imgClassName)}
    />
  );
  return (
    <div ref={ref} className={cn('relative', className)}>
      {priority && photo.heroHiddenMedia ? (
        <picture>
          <source media={photo.heroHiddenMedia} srcSet={NOTHING} />
          {img}
        </picture>
      ) : (
        img
      )}
    </div>
  );
}

function DrawnPack({ className, imgClassName, priority = false, sizes }: PackProps) {
  const { image, packHeart: heart } = product;
  const [ref, inView] = useInView<HTMLDivElement>('-15% 0px');
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (inView) setRun((r) => r + 1);
  }, [inView]);
  const beatAgain = () => setRun((r) => r + 1);
  const place = { left: `${heart.left}%`, top: `${heart.top}%`, width: `${heart.w}%`, height: `${heart.h}%` };
  return (
    <div ref={ref} className={cn('relative', className)} onPointerEnter={beatAgain} onClick={beatAgain}>
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes={sizes}
        alt={image.alt}
        width={image.width}
        height={image.height}
        fetchPriority={priority ? 'high' : undefined}
        loading={priority ? undefined : 'lazy'}
        decoding="async"
        className={cn('relative block h-auto w-full', imgClassName)}
      />
      <span
        key={`glow-${run}`}
        aria-hidden="true"
        className={cn('pointer-events-none absolute rounded-full opacity-0', run > 0 && 'pack-glow')}
        style={{ ...place, left: `${heart.left - 4}%`, width: `${heart.w + 8}%` }}
      />
      <img
        key={`heart-${run}`}
        src={heart.src}
        alt=""
        aria-hidden="true"
        width={heart.width}
        height={heart.height}
        decoding="async"
        loading={priority ? undefined : 'lazy'}
        className={cn('pointer-events-none absolute', run > 0 && 'pack-heart')}
        style={place}
      />
    </div>
  );
}
