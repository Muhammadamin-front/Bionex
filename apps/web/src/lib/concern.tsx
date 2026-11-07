import { CONCERN_IDS, CONCERNS, type ConcernId } from '@bionex/shared/concerns';
import { createContext, useContext, useState } from 'react';
import { sendConcern } from './api';
import { cn } from './cn';

/** Whether the thank-you screen asks «Сизни нима безовта қилади?»: the main site's choice (sites/classic). */
export const AskConcernContext = createContext(false);

/**
 * The Telegram channel offered after the order. Main site (sites/classic): the phone moves on to it after
 * the questions. Partner site (sites/partner.tsx, owner 2026-11-07): no questions, so only the link.
 */
export const TelegramChannelContext = createContext<string | null>(null);

/** The channel link on the thank-you screen. */
function ChannelLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="mt-3 flex min-h-14 items-center justify-center rounded-2xl bg-forest px-4 text-center font-display text-lg font-bold text-white">
      Телеграм каналимизга ўтиш
    </a>
  );
}

/**
 * The optional question after an order is in. Its last tap (answered or skipped) opens the Telegram
 * channel. Only after it: going there at once would leave the question unanswered. If a phone does
 * not hand over to Telegram, a real link stays on screen.
 * Without the question (partner site) only the link shows, and nothing moves the phone by itself:
 * a move as the order lands could cut off the browser Pixel Lead sent at that moment.
 */
export function AfterOrderQuestions({ submissionId }: { submissionId: string }) {
  const ask = useContext(AskConcernContext);
  const channel = useContext(TelegramChannelContext);
  const [done, setDone] = useState(false);
  const [answered, setAnswered] = useState(false);
  if (!ask) {
    return channel ? (
      <div className="mx-auto mt-6 max-w-sm">
        <ChannelLink href={channel} />
      </div>
    ) : null;
  }
  if (!done) {
    return (
      <ConcernQuestion
        submissionId={submissionId}
        onDone={(gaveAnswer) => {
          setAnswered(gaveAnswer);
          setDone(true);
          // Still within the tap, which phones ask for before opening another app; the moment lets the answer leave.
          if (channel) window.setTimeout(() => window.location.assign(channel), 350);
        }}
      />
    );
  }
  return (
    <div className="mx-auto mt-6 max-w-sm" role="status">
      {answered && <p className="rounded-2xl bg-paper px-4 py-3 text-lg font-bold text-brand-2">Раҳмат! Мутахассисларимизга етказилди.</p>}
      {channel && <ChannelLink href={channel} />}
    </div>
  );
}

/**
 * The optional question after an order is in: it costs no orders, and the operator opens the call
 * knowing the customer's worry. Several answers may be picked; the answer goes once.
 */
function ConcernQuestion({ submissionId, onDone }: { submissionId: string; onDone: (answered: boolean) => void }) {
  const [picked, setPicked] = useState<ConcernId[]>([]);
  const toggle = (c: ConcernId) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const send = () => {
    // Best effort: the order is already in; a lost answer only means the operator asks on the call.
    void sendConcern({ submissionId, concerns: picked }).catch(() => undefined);
    onDone(true);
  };
  return (
    <div className="mx-auto mt-6 max-w-sm border-t border-line pt-5 text-left">
      <p className="font-display text-xl font-extrabold leading-snug">Сизни кўпроқ нима безовта қилади?</p>
      <p className="mt-1 text-base text-muted">Мутахассисларимиз шунга қараб маслаҳат беради. Бир нечтасини белгилаш мумкин.</p>
      <div className="mt-4 grid grid-cols-1 gap-2">
        {CONCERN_IDS.map((c) => {
          const on = picked.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(c)}
              className={cn(
                'flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 text-left text-lg font-bold transition-colors',
                on ? 'border-brand bg-brand text-white' : 'border-line bg-paper text-ink',
              )}
            >
              <span className={cn('grid h-6 w-6 flex-none place-items-center rounded-md border-2', on ? 'border-white bg-white text-brand' : 'border-line bg-card')} aria-hidden="true">
                {on ? '✓' : ''}
              </span>
              {CONCERNS[c].cyrl}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={send}
        disabled={!picked.length}
        className="mt-4 min-h-14 w-full rounded-2xl bg-forest px-4 font-display text-lg font-bold text-white disabled:opacity-40"
      >
        Мутахассисга юбориш
      </button>
      <button type="button" onClick={() => onDone(false)} className="mt-2 min-h-12 w-full text-base font-semibold text-muted underline">
        Ўтказиб юбориш
      </button>
    </div>
  );
}
