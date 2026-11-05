import { CONCERN_IDS, CONCERNS, REGION_IDS, REGIONS, type ConcernId, type RegionId } from '@bionex/shared/concerns';
import { createContext, useContext, useState } from 'react';
import { sendConcern, sendRegion } from './api';
import { cn } from './cn';

/** Whether the thank-you screen asks its questions (region, then «Сизни нима безовта қилади?»): the main site's choice (sites/classic). */
export const AskConcernContext = createContext(false);

/** The optional questions after an order is in, one at a time: the one-tap region first. */
export function AfterOrderQuestions({ submissionId }: { submissionId: string }) {
  const ask = useContext(AskConcernContext);
  const [regionDone, setRegionDone] = useState(false);
  if (!ask) return null;
  if (!regionDone) return <RegionQuestion submissionId={submissionId} onDone={() => setRegionDone(true)} />;
  return <ConcernQuestion submissionId={submissionId} />;
}

/** One tap sends it and moves on. Best effort: a lost answer only means the operator asks on the call. */
function RegionQuestion({ submissionId, onDone }: { submissionId: string; onDone: () => void }) {
  const pick = (region: RegionId) => {
    void sendRegion({ submissionId, region }).catch(() => undefined);
    onDone();
  };
  return (
    <div className="mx-auto mt-6 max-w-sm border-t border-line pt-5 text-left">
      <p className="font-display text-xl font-extrabold leading-snug">Қайси вилоятдансиз?</p>
      <p className="mt-1 text-base text-muted">Биттасини босинг, мутахассисларимиз билиб туради.</p>
      {/* First and last across the full width: «Қорақалпоғистон» does not fit half a phone screen in one word. */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {REGION_IDS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => pick(r)}
            className="min-h-14 rounded-2xl border-2 border-line bg-paper px-1 text-center text-base font-bold leading-tight text-ink first:col-span-2 last:col-span-2 max-[350px]:text-[0.8rem]"
          >
            {REGIONS[r].cyrl}
          </button>
        ))}
      </div>
      <button type="button" onClick={onDone} className="mt-2 min-h-12 w-full text-base font-semibold text-muted underline">
        Ўтказиб юбориш
      </button>
    </div>
  );
}

/**
 * The optional question after an order is in: it costs no orders, and the operator opens the call
 * knowing the customer's worry. Several answers may be picked; the answer goes once.
 */
function ConcernQuestion({ submissionId }: { submissionId: string }) {
  const [picked, setPicked] = useState<ConcernId[]>([]);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  if (state === 'sent') {
    return <p className="mx-auto mt-6 max-w-sm rounded-2xl bg-paper px-4 py-3 text-lg font-bold text-brand-2" role="status">Раҳмат! Мутахассисларимизга етказилди.</p>;
  }
  const toggle = (c: ConcernId) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const send = async () => {
    setState('sending');
    // Best effort: the order is already in; a lost answer only means the operator asks on the call.
    await sendConcern({ submissionId, concerns: picked }).catch(() => undefined);
    setState('sent');
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
        onClick={() => void send()}
        disabled={!picked.length || state === 'sending'}
        className="mt-4 min-h-14 w-full rounded-2xl bg-forest px-4 font-display text-lg font-bold text-white disabled:opacity-40"
      >
        {state === 'sending' ? 'Юборилмоқда…' : 'Мутахассисга юбориш'}
      </button>
    </div>
  );
}
