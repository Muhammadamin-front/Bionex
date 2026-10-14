import { useEffect, useState } from 'react';
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
export function ProductPack({
  className,
  imgClassName,
  priority = false,
  sizes,
}: {
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  /** Rendered width hint for picking the right file from srcSet. */
  sizes: string;
}) {
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
