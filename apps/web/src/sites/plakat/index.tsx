// The workers.dev test page (owner, 2026-11-14: a new design and structure, A/B-tested against zeynara.com.uz with
// its own ad). «Саломатлик плакати»: the specialist's explanation printed as the clinic corridor's numbered health
// poster, in three inks — ultramarine, ochre and black — on matte paper. The order form is the poster's step 1.
// Built only with MAIN_PAGE=plakat (the Worker's `deploy:plakat`); zeynara.com.uz keeps sites/classic.
// Same order form, same rules, same group and sheet as the main site; the words come from ../classic/copy.ts.
import '@fontsource/fira-sans-extra-condensed/800.css';
import '../../styles.css';
import './plakat.css';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ConfirmAutofillContext, OrderForm, type OrderResult } from '../../components/landing/OrderForm';
import { PhoneIcon } from '../../components/ui/Icons';
import { product, site } from '../../config/product';
import { AskConcernContext, TelegramChannelContext } from '../../lib/concern';
import { PageCopyContext } from '../../lib/copy';
import { initPixel } from '../../lib/pixel';
import { captureUtm } from '../../lib/utm';
import { MAIN_COPY } from '../classic/copy';
import { useNear } from '../classic/certificate';
import { certificate, photoSet, pic, writtenReviews } from '../classic/media';
import { CUSTOMERS, REPEAT_BUYERS } from '../classic/stats';
import { VideoRow } from '../classic/video-row';

const HOURS = '9:00–21:00';
const front = photoSet('pack-front', [360, 540, 720]);

/**
 * This page's own prints (./media, gitignored like every customer's face): the box as a one-ink halftone and the faces
 * as two-ink duotones, computed from the main site's media (AGENTS.md #71). A missing print falls back to the original.
 */
const prints = import.meta.glob<string>('./media/*.{png,webp}', { eager: true, query: '?url', import: 'default' });
const printOf = (name: string) => prints[`./media/${name}`];
const boxPrint = printOf('pack-print-360.png') && printOf('pack-print-720.png')
  ? { src: printOf('pack-print-360.png')!, srcSet: `${printOf('pack-print-360.png')} 360w, ${printOf('pack-print-720.png')} 720w` }
  : undefined;
const faceOf = (video: string) => printOf(`face-${video}.webp`) ?? printOf(`${video}-face.webp`) ?? pic(`face-${video}`) ?? pic(`${video}-face`) ?? pic(video);

/** Whether `ref` is on screen (any part of it), for the bottom bar. */
function useOnScreen(ref: RefObject<HTMLElement | null>) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOn(Boolean(e?.isIntersecting)), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return on;
}

/* Pictograms, drawn as print: one stroke, square-ended, in the ink of their panel. */
function Picto({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 32 32" className="plakat-picto" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
const PICTOS = {
  person: (
    <Picto>
      <circle cx="13" cy="10" r="4.5" />
      <path d="M5 27c0-5 3.6-8.5 8-8.5 2 0 3.8.7 5.2 1.9" />
      <path d="M22.5 17.5a3.5 3.5 0 1 1 3.5 3.6v1.6M26 26.5v.5" />
    </Picto>
  ),
  leaf: (
    <Picto>
      <path d="M7 25C7 13 14 6 26 6c0 12-7 19-19 19Z" />
      <path d="M7 25 18 14" />
    </Picto>
  ),
  cup: (
    <Picto>
      <path d="M7 12h16v6a8 8 0 0 1-16 0v-6Z" />
      <path d="M23 14h2.5a3 3 0 0 1 0 6H23M11 4.5c0 2 2 2 2 4M16 4.5c0 2 2 2 2 4" />
    </Picto>
  ),
  pills: (
    <Picto>
      <rect x="5" y="11" width="15" height="9" rx="4.5" transform="rotate(-35 12.5 15.5)" />
      <path d="m10 19.8 5-7.2" />
      <circle cx="23" cy="22" r="5" />
    </Picto>
  ),
  truck: (
    <Picto>
      <path d="M3 8h15v13H3zM18 12h6l5 5v4H18" />
      <circle cx="9" cy="23.5" r="2.5" />
      <circle cx="23" cy="23.5" r="2.5" />
    </Picto>
  ),
} as const;

/** The specialist's points, as the poster's small print. Every fact is product.ts's or copy.ts's own. */
const EXPLAINS: Array<{ picto: keyof typeof PICTOS; q: string; a: string }> = [
  { picto: 'person', q: 'Зейнара сизга мосми', a: 'Ёшингиз, босимингиз ва нималар безовта қилишини сўраб, мос-мос эмаслигини айтади.' },
  { picto: 'leaf', q: 'Таркибида нима бор', a: '9 хил ўсимлик экстрактидан тайёрланган сироп, 330 мл. Дори эмас, биологик фаол қўшимча.' },
  { picto: 'cup', q: 'Қандай ичилади', a: `${product.dosage.rows[0]?.how ?? ''}` },
  {
    picto: 'pills',
    q: 'Дориларим билан бирга бўладими',
    a: 'Мутахассис тушунтиради. Шифокор буюрган дориларни ўзбошимчалик билан тўхтатманг.',
  },
  { picto: 'truck', q: 'Қандай етказилади', a: 'Ўзбекистон бўйлаб 1–3 кунда, бепул. Тўловни маҳсулотни олганингизда қиласиз.' },
];

function Masthead() {
  return (
    <header className="plakat-mast">
      <a href="#asosiy" className="plakat-mark">
        ЗЕЙНАРА
      </a>
      <span className="plakat-mast-note">Юрак ва қон томирлар учун табиий сироп</span>
      {site.phone && site.phoneHref && (
        <a href={site.phoneHref} className="plakat-call" aria-label={`Қўнғироқ қилиш: ${site.phone}`}>
          <PhoneIcon className="h-5 w-5" />
          <span className="plakat-call-number">{site.phone}</span>
        </a>
      )}
    </header>
  );
}

/** A numbered roundel, the poster's own counter. */
function Roundel({ n, tone = 'ochre' }: { n: number; tone?: 'ochre' | 'paper' }) {
  return (
    <span className={`plakat-roundel plakat-roundel--${tone}`} aria-hidden="true">
      {n}
    </span>
  );
}

/** Step 1: the order form on the poster's paper, inside a double printed rule. */
function StepOne({
  id,
  sectionRef,
  title,
  utm,
  order,
  onOrdered,
}: {
  id: string;
  sectionRef: RefObject<HTMLElement | null>;
  title: string;
  utm: ReturnType<typeof captureUtm>;
  order: OrderResult | null;
  onOrdered: (r: OrderResult) => void;
}) {
  return (
    <section id={id} ref={sectionRef} aria-label="Ариза формаси" className="plakat-step1 scroll-mt-4">
      <Roundel n={1} />
      <p className="plakat-step1-title">{title}</p>
      <OrderForm utm={utm} variant="hero" completed={order} onSuccess={onOrdered} />
    </section>
  );
}

function NextSteps() {
  return (
    <ol className="plakat-next" aria-label="Кейинги қадамлар">
      <li>
        <Roundel n={2} tone="paper" />
        <span>
          <b>Мутахассис қўнғироқ қилади</b> {HOURS}, мослигини тушунтиради
        </span>
      </li>
      <li>
        <Roundel n={3} tone="paper" />
        <span>
          <b>Мос бўлса, уйингизга</b> 1–3 кунда, тўлов олганда
        </span>
      </li>
    </ol>
  );
}

function Hero({ form }: { form: ReactNode }) {
  return (
    <section id="asosiy" className="plakat-hero">
      <Masthead />
      <div className="plakat-hero-grid">
        <div className="plakat-hero-words">
          {/* Two lines' room on a phone (plakat.css), so the display face arriving never pushes the form down. */}
          <h1 className="plakat-h1">
            Босим, бош оғриғи, <em>тез чарчоқ?</em>
          </h1>
          <p className="plakat-lead">Мутахассис қўнғироқ қилиб, Зейнара сизга мосми — тушунтириб беради.</p>
          <div className="plakat-next-wide">
            <NextSteps />
          </div>
        </div>
        <div className="plakat-hero-form">{form}</div>
      </div>
      <div className="plakat-next-narrow">
        <NextSteps />
      </div>
    </section>
  );
}

/** What the specialist explains on the call: the poster's small print, ruled, not boxed. */
function Explains() {
  return (
    <section aria-labelledby="tushuntiradi" className="plakat-paper">
      <div className="plakat-wrap">
        <h2 id="tushuntiradi" className="plakat-h2">
          Мутахассис қўнғироқда <span className="plakat-ink-blue">нимани тушунтиради</span>
        </h2>
        <ul className="plakat-explains">
          {EXPLAINS.map((e) => (
            <li key={e.q}>
              {PICTOS[e.picto]}
              <div>
                <h3>{e.q}</h3>
                <p>{e.a}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * The real box, printed: it arrives as the poster's two-ink halftone and resolves into the photograph as it comes
 * into view (the page's one authored motion; none for someone who asked for less motion, see plakat.css).
 */
function RealBox() {
  const [ref, near] = useNear<HTMLDivElement>();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setShown(true);
    const io = new IntersectionObserver(([e]) => e && e.intersectionRatio >= 0.45 && setShown(true), { threshold: [0, 0.45] });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  if (!front) return null;
  return (
    <section aria-labelledby="quti" className="plakat-blue">
      <div className="plakat-wrap plakat-box-grid">
        <div ref={ref} className={`plakat-print ${shown ? 'is-printed' : ''}`}>
          <img
            src={near ? front.src : undefined}
            srcSet={near ? front.srcSet : undefined}
            sizes="(min-width: 1024px) 420px, 80vw"
            width={720}
            height={960}
            alt="Зейнара сиропи қадоғи, 330 мл"
            decoding="async"
          />
          {/* The same photograph as the poster prints it; it lifts away to show the photograph. */}
          {boxPrint && (
            <img
              className="plakat-print-plate"
              src={near ? boxPrint.src : undefined}
              srcSet={near ? boxPrint.srcSet : undefined}
              sizes="(min-width: 1024px) 420px, 80vw"
              width={720}
              height={960}
              alt=""
              decoding="async"
            />
          )}
        </div>
        <div className="plakat-box-words">
          <h2 id="quti" className="plakat-h2 plakat-on-blue">
            Мана шу қутида <em>сизга етказилади</em>
          </h2>
          <p className="plakat-on-blue-text">
            Зейнара сиропи, 330 мл. 9 хил ўсимлик экстракти. Рецептсиз, ҳалол. Қадоқ ташқаридан нима эканлиги кўринмайди.
          </p>
          {certificate.full && <CertificateNote full={certificate.full} small={certificate.small} />}
        </div>
      </div>
    </section>
  );
}

function CertificateNote({ full, small }: { full: string; small?: string }) {
  const [ref, near] = useNear<HTMLAnchorElement>();
  return (
    <figure className="plakat-cert">
      <a ref={ref} href={full} target="_blank" rel="noopener" className="plakat-cert-thumb">
        <img src={near ? (small ?? full) : undefined} width={480} height={643} alt="Санитария-эпидемиологик хулоса № 482583" />
      </a>
      <figcaption>
        <b>Давлат текширувидан ўтган.</b> Соғлиқни сақлаш вазирлигининг санитария-эпидемиологик хулосаси № 482583: хавфсизлик
        кўрсаткичлари бўйича меъёрларга мос. 29.07.2028 гача амал қилади.{' '}
        <a href={full} target="_blank" rel="noopener">
          Ҳужжатни кўриш
        </a>
      </figcaption>
    </figure>
  );
}

/** The owner's two figures, said as a sentence on the ochre band, not as stat tiles. */
function Figures() {
  return (
    <section aria-label="Мижозларимиз" className="plakat-ochre">
      <p className="plakat-wrap plakat-figures">
        <span className="plakat-figure">{CUSTOMERS}</span> мижозимиз бор. Улардан <span className="plakat-figure">{REPEAT_BUYERS}</span> қайта
        харид қилади.
      </p>
    </section>
  );
}

/** The customers: their videos, then their words in a printed column, the first set large. */
function Customers() {
  const [ref, near] = useNear<HTMLDivElement>();
  const quotes = writtenReviews.map((r) => ({ ...r, face: faceOf(r.video) }));
  const [first, ...rest] = quotes;
  return (
    <section aria-labelledby="mijozlar" className="plakat-paper">
      <div className="plakat-wrap">
        <h2 id="mijozlar" className="plakat-h2">
          Мижозларимиз <span className="plakat-ink-blue">ўзлари айтади</span>
        </h2>
        <VideoRow
          look={{
            row: 'plakat-videos',
            frame: 'plakat-video',
            video: 'block aspect-[3/4] w-full bg-[#141414]',
            sound: 'plakat-sound',
            caption: 'plakat-video-caption',
            soundLabel: (
              <>
                <svg viewBox="0 0 24 24" className="plakat-speaker" aria-hidden="true" focusable="false">
                  <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
                  <path d="M15.5 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
                </svg>
                Овозни ёқиш
              </>
            ),
          }}
        />
        <div ref={ref} className="plakat-quotes">
          {first && (
            <blockquote className="plakat-quote-lead">
              <p>«{first.text}»</p>
              <footer>
                {first.face && <img src={near ? first.face : undefined} alt="" width={64} height={64} className="plakat-face" />}
                {first.who}
              </footer>
            </blockquote>
          )}
          <ul className="plakat-quote-list">
            {rest.map((r) => (
              <li key={r.video}>
                <p>«{r.text}»</p>
                <footer>
                  {r.face && <img src={near ? r.face : undefined} alt="" width={48} height={48} className="plakat-face" />}
                  {r.who}
                </footer>
              </li>
            ))}
          </ul>
          <p className="plakat-small">Натижалар ҳар бир инсонда турлича бўлиши мумкин.</p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="plakat-footer">
      <div className="plakat-wrap">
        <p className="plakat-mark">ЗЕЙНАРА</p>
        <p>
          Биологик фаол қўшимча (БАД), дори воситаси эмас. Санитария-эпидемиологик хулоса № 482583. Шифокор буюрган дориларни
          ўзбошимчалик билан тўхтатманг.
        </p>
        {site.phone && site.phoneHref && (
          <p>
            Қўнғироқ учун: <a href={site.phoneHref}>{site.phone}</a>
          </p>
        )}
      </div>
    </footer>
  );
}

/** The phones' bar: away while a form is on screen or a field has focus (it once covered the form's button). */
function Bar({ hidden, onOrder }: { hidden: boolean; onOrder: () => void }) {
  return (
    <div className="plakat-bar" style={{ transform: hidden ? 'translate3d(0,110%,0)' : 'translate3d(0,0,0)' }} aria-hidden={hidden}>
      {site.phone && site.phoneHref && (
        <a href={site.phoneHref} tabIndex={hidden ? -1 : 0} aria-label={`Қўнғироқ қилиш: ${site.phone}`} className="plakat-bar-call">
          <PhoneIcon className="h-6 w-6" />
        </a>
      )}
      <button type="button" tabIndex={hidden ? -1 : 0} onClick={onOrder} className="plakat-bar-order">
        {MAIN_COPY.bar}
      </button>
    </div>
  );
}

export function Landing() {
  const utm = useMemo(() => captureUtm(), []);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const topRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLElement>(null);
  const topOn = useOnScreen(topRef);
  const endOn = useOnScreen(endRef);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    initPixel();
    const isField = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
    const onIn = (e: FocusEvent) => isField(e.target) && setTyping(true);
    const onOut = (e: FocusEvent) => isField(e.target) && setTyping(false);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  // To the nearest form, with the name field ready: the first one until the visitor has scrolled past it.
  const toForm = () => {
    const top = topRef.current;
    const target = top && top.getBoundingClientRect().bottom > 0 ? top : endRef.current;
    const name = target?.querySelector<HTMLInputElement>('input[name=zn-customer]');
    if (name) {
      name.scrollIntoView({ block: 'center', behavior: 'smooth' });
      name.focus({ preventScroll: true });
    } else target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <AskConcernContext.Provider value={true}>
      <TelegramChannelContext.Provider value="https://t.me/zeynare">
        <ConfirmAutofillContext.Provider value={true}>
          <PageCopyContext.Provider value={MAIN_COPY}>
            <div className="plakat">
              <a href="#tez-buyurtma" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-[#141414] focus:px-4 focus:py-3 focus:text-white">
                Ариза формасига ўтиш
              </a>
              <main>
                <Hero
                  form={
                    <StepOne id="tez-buyurtma" sectionRef={topRef} title="Исм ва рақамингиз" utm={utm} order={order} onOrdered={setOrder} />
                  }
                />
                <Explains />
                <RealBox />
                <Figures />
                <Customers />
                <section aria-label="Ариза" className="plakat-blue plakat-close">
                  <div className="plakat-wrap plakat-close-grid">
                    <h2 className="plakat-h2 plakat-on-blue">
                      Мутахассис сизга <em>қўнғироқ қилсин</em>
                    </h2>
                    <StepOne id="forma" sectionRef={endRef} title="Исм ва рақамингиз" utm={utm} order={order} onOrdered={setOrder} />
                  </div>
                </section>
              </main>
              <Footer />
              <Bar hidden={typing || topOn || endOn || Boolean(order)} onOrder={toForm} />
            </div>
          </PageCopyContext.Provider>
        </ConfirmAutofillContext.Provider>
      </TelegramChannelContext.Provider>
    </AskConcernContext.Provider>
  );
}
