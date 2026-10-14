import type { SVGProps } from 'react';

/** Inline stroke icons (no icon library in the bundle). */
function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export type IconName = 'truck' | 'wallet' | 'phone' | 'box' | 'shield' | 'clock';

export const icons: Record<IconName, () => React.JSX.Element> = {
  truck: () => (
    <Svg>
      <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17.5" cy="17.5" r="1.8" />
    </Svg>
  ),
  wallet: () => (
    <Svg>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M16 14.5h2" />
    </Svg>
  ),
  phone: () => (
    <Svg>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </Svg>
  ),
  box: () => (
    <Svg>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </Svg>
  ),
  shield: () => (
    <Svg>
      <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  ),
  clock: () => (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  ),
};

export function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <Svg width="20" height="20" strokeWidth="2.2">
      <path d={dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </Svg>
  );
}

export function PhoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg width="18" height="18" {...props}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </Svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg width="20" height="20" strokeWidth="2.6" {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function AlertIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg width="24" height="24" strokeWidth="2.2" {...props}>
      <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" />
      <path d="M12 10v4.2M12 17.2v.1" />
    </Svg>
  );
}

export function QuoteMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 66 48" width="66" height="48" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="currentColor"
        d="M0 48V29.6C0 12.8 8.6 2.9 25.7 0l2.7 6.3C19.7 9 15.4 14.2 14.8 22H27v26H0Zm36.6 0V29.6C36.6 12.8 45.2 2.9 62.3 0L65 6.3C56.3 9 52 14.2 51.4 22h12.2v26h-27Z"
      />
    </svg>
  );
}
