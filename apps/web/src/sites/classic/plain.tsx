// The workers.dev test page (owner, 2026-11-07: «sherik sayti bilan bir xil qil … videolarni qo'shma, ui ni
// o'zgartirma, faqat sertifikatni qo'shsang bo'ladi»). Built only for the Worker's own address
// (MAIN_PAGE=plain in its `deploy`); zeynara.com.uz keeps the full page (index.tsx).
//
// What it shows is what workers.dev showed from 2026-11-06 13:43 (the main page with no media): the
// original first screen, the drawn pack, no videos, no photos — plus the certificate under the first
// form. What it does is the partner site's way (vite.config.ts and the Worker read `rules: 'partner'`):
// the «not a robot» check for everyone, no «is this number in use?» step, no questions after the order,
// the order dialog as soon as the page is ready. The Worker sends a Lead for every order that is not a
// trap and keeps «sent too fast» orders in «Lidlar». Orders still go to our group, sheet and Pixel.
import '@fontsource-variable/montserrat/wght.css';
import '../../styles.css';
import { Landing as Page } from '../../components/landing/Landing';
import { Certificate } from './certificate';

// The certificate only: an eager glob emits every file it matches, so the videos and photos are not even built.
const media = import.meta.glob<string>('./media/certificate*.jpg', { eager: true, query: '?url', import: 'default' });
const full = media['./media/certificate.jpg'];
const small = media['./media/certificate-small.jpg'];

function CertificateSection() {
  if (!full) return null;
  return (
    <section aria-label="Давлат текширувидан ўтган" className="bg-paper-2">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <Certificate full={full} small={small} spaced={false} />
      </div>
    </section>
  );
}

export function Landing() {
  // popupAfterMs 0: the dialog opens as on the partner site (as soon as the page is ready), but, unlike
  // there, this page takes typing before it is ready (scripts/early.js), so it must stay shut for someone
  // already filling in the form — which only the timed dialog checks (OrderModal).
  return <Page proof={<CertificateSection />} popupAfterMs={0} barOverForms={false} />;
}
