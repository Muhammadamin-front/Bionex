import { CONCERN_IDS, CONCERNS, type ConcernId } from '@bionex/shared/concerns';
import { createContext, useContext, useState } from 'react';
import { sendConcern } from './api';
import { cn } from './cn';

/** Whether the thank-you screen asks «Сизни нима безовта қилади?» — the main site's choice (sites/classic). */
export const AskConcernContext = createContext(false);

/**
 * The optional question after an order is in: it costs no orders, and the operator opens the call
 * knowing the customer's worry. Several answers may be picked; the answer goes once.
 */
export function ConcernQuestion({ submissionId }: { submissionId: string }) {
  const ask = useContext(AskConcernContext);
  const [picked, setPicked] = useState<ConcernId[]>([]);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  if (!ask) return null;
  if (state === 'sent') {
    return <p className="mx-auto mt-6 max-w-sm rounded-2xl bg-paper px-4 py-3 text-lg font-bold text-brand-2" role="status">Раҳмат! Операторга етказилди.</p>;
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
      <p className="mt-1 text-base text-muted">Оператор шунга қараб маслаҳат беради. Бир нечтасини белгилаш мумкин.</p>
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
        {state === 'sending' ? 'Юборилмоқда…' : 'Операторга юбориш'}
      </button>
    </div>
  );
}
