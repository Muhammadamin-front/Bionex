import { HONEYPOT_FIELD, TURNSTILE_ACTION } from '@bionex/shared/constants';
import { caretAfterDigits, formatNationalAsTyped, formatUzPhone, nationalDigitsFromInput } from '@bionex/shared/phone';
import type { Utm } from '@bionex/shared/utm';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { site } from '../../config/product';
import { ApiRequestError, newSubmissionId, submitLead } from '../../lib/api';
import { cn } from '../../lib/cn';
import { deviceFingerprint, deviceId, deviceModel, deviceSignals } from '../../lib/device';
import { trackInitiateCheckout, trackLead } from '../../lib/pixel';
import { loadTurnstile } from '../../lib/turnstile';
import { AntiMetalButton } from '../ui/AntiMetalButton';
import { CheckIcon, PhoneIcon } from '../ui/Icons';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';
/** Validation schemas (Zod) are fetched with the form, not with the first paint. */
const loadSchemas = () => import('@bionex/shared/lead');

/**
 * Cloudflare offers no Uzbek. For an audience of older Uzbek speakers Russian is far more
 * likely to be understood than English, so the (rarely shown) challenge uses Russian
 * unless the browser asks for another language Cloudflare supports.
 */
function turnstileLanguage(): string {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || '';
  return /^(uz|ru|kk|ky|tg)/i.test(lang) || !lang ? 'ru' : 'auto';
}

type Field = 'fullName' | 'phone';
type FieldErrors = Partial<Record<Field, string>>;

export interface OrderResult {
  message: string;
  /** Formatted for display: "+998 90 123 45 67". */
  phone: string;
}

interface Verification {
  submissionId: string;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const CHECK_FAILED = `Хавфсизлик текширувини ўтказиб бўлмади. Саҳифани янгилаб, қайта уриниб кўринг${
  site.phone ? ` ёки ${site.phone} рақамига қўнғироқ қилинг` : ''
}.`;

/**
 * `full`: the order section's form. `compact`: the hero form — same behaviour, fields side
 * by side on wider screens, so the working action sits in the first screen.
 *
 * `completed` is shared by both forms on the page: once either one succeeds, both show the
 * confirmation, so nobody is asked to order a second time.
 */
export function OrderForm({
  utm,
  variant = 'full',
  completed,
  onSuccess,
}: {
  utm: Utm;
  variant?: 'full' | 'compact';
  completed: OrderResult | null;
  onSuccess: (result: OrderResult) => void;
}) {
  const compact = variant === 'compact';
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const websiteRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const widgetBox = useRef<HTMLDivElement>(null);
  /** The wide check box needs 300 px; narrower forms get Cloudflare's square compact widget. */
  const compactRef = useRef(false);
  const submittedHere = useRef(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState(''); // national part, formatted "90 123 45 67"
  /** Where the caret must go after the next render of the phone field (see onPhoneChange). */
  const pendingCaret = useRef<number | null>(null);
  const [caretTick, setCaretTick] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waitingForCheck, setWaitingForCheck] = useState(false);

  const verification = useRef<Verification | null>(null);
  const turnstileToken = useRef<string | null>(null);
  const widgetId = useRef<string | null>(null);
  const tokenWaiters = useRef<Array<(token: string | null) => void>>([]);
  const preparing = useRef<Promise<void> | null>(null);
  /** Payload of the last request that got no answer (network error) — safe to retry with the same token. */
  const unansweredPayload = useRef<string | null>(null);
  /** Bumped by every refresh, so a slower, older refresh can never overwrite a newer one. */
  const generation = useRef(0);

  const resolveWaiters = (token: string | null) => {
    for (const resolve of tokenWaiters.current.splice(0)) resolve(token);
  };

  const renderWidget = useCallback(async (submissionId: string, gen: number) => {
    const turnstile = await loadTurnstile();
    if (!widgetBox.current || gen !== generation.current) return;
    if (widgetId.current) turnstile.remove(widgetId.current);
    turnstileToken.current = null;
    widgetId.current = turnstile.render(widgetBox.current, {
      sitekey: SITE_KEY,
      action: TURNSTILE_ACTION,
      cData: submissionId, // the server checks the token was issued for this exact form
      // Shown only when Cloudflare actually wants a check. Almost nobody is asked, and the
      // widget took up the width of the form between the phone field and the order button:
      // on a phone that is the last thing seen before pressing it, and it reads like one more
      // hoop. Hidden, an order is two fields; a visitor who does get a check still sees it.
      appearance: 'interaction-only',
      // 'flexible' is at least 300 px wide and would push narrow phones into zoom-out.
      size: compactRef.current ? 'compact' : 'flexible',
      language: turnstileLanguage(),
      'refresh-expired': 'auto',
      callback: (token) => {
        turnstileToken.current = token;
        resolveWaiters(token);
      },
      'expired-callback': () => {
        turnstileToken.current = null;
      },
      'error-callback': () => {
        turnstileToken.current = null;
        resolveWaiters(null);
      },
    });
  }, []);

  /** Start a new order attempt: a fresh id, and a new Turnstile widget bound to it. */
  const refreshVerification = useCallback(async () => {
    const gen = ++generation.current;
    turnstileToken.current = null;
    const submissionId = newSubmissionId();
    verification.current = { submissionId };
    await renderWidget(submissionId, gen);
  }, [renderWidget]);

  const prepare = useCallback(() => {
    preparing.current ??= Promise.all([refreshVerification(), loadSchemas()])
      .then(() => undefined)
      .catch(() => {
        preparing.current = null; // try again on submit
      });
    return preparing.current;
  }, [refreshVerification]);

  // Start loading Turnstile + validation when the form is ~1 screen away.
  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      void prepare();
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void prepare();
          io.disconnect();
        }
      },
      { rootMargin: '800px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [prepare]);

  useEffect(
    () => () => {
      generation.current++;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
      preparing.current = null;
    },
    [],
  );

  // The other form succeeded (or this one did): release the security widget.
  useEffect(() => {
    if (!completed) return;
    if (widgetId.current) window.turnstile?.remove(widgetId.current);
    widgetId.current = null;
    if (submittedHere.current) successRef.current?.focus();
  }, [completed]);

  async function validateField(field: Field, value: string): Promise<string | undefined> {
    const { fullNameSchema, phoneSchema } = await loadSchemas();
    const schema = field === 'fullName' ? fullNameSchema : phoneSchema;
    const r = schema.safeParse(field === 'phone' ? (value ? `+998${value.replace(/\D/g, '')}` : '') : value);
    return r.success ? undefined : r.error.issues[0]?.message;
  }

  async function onBlur(field: Field) {
    const value = field === 'fullName' ? fullName : phone;
    if (!value.trim()) return; // do not shout at someone just tabbing through
    const message = await validateField(field, value);
    setErrors((e) => ({ ...e, [field]: message }));
  }

  /**
   * Reformats as "90 123 45 67" while keeping the caret where the person is typing:
   * correcting a digit in the middle must not throw the caret to the end (which silently
   * produces a wrong number). Deleting a space deletes the digit before it.
   */
  function onPhoneChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    let digitsBefore = raw.slice(0, caret).replace(/\D/g, '').length;
    let { digits, dropped } = nationalDigitsFromInput(raw);

    const prevDigits = phone.replace(/\D/g, '');
    if (digits === prevDigits && raw.length < phone.length && digitsBefore > 0) {
      // Backspace hit a space: remove the digit in front of it instead.
      digits = digits.slice(0, digitsBefore - 1) + digits.slice(digitsBefore);
      digitsBefore -= 1;
    }
    digitsBefore = Math.max(0, Math.min(digits.length, digitsBefore - dropped));

    const formatted = formatNationalAsTyped(digits);
    setPhone(formatted);
    if (errors.phone) setErrors((x) => ({ ...x, phone: undefined }));
    pendingCaret.current = caretAfterDigits(formatted, digitsBefore);
    setCaretTick((t) => t + 1); // re-render even when the text did not change
  }

  // Which widget size to ask for, if a visitor is ever shown one. Measured on the form, not
  // on the mount point: that one is hidden while empty, so it would always measure as narrow.
  useLayoutEffect(() => {
    compactRef.current = (formRef.current?.clientWidth ?? 400) < 300;
  }, []);

  // Runs synchronously right after React writes the new value, before the next keystroke
  // can arrive, so fast typing or a held key never lands at the wrong position.
  useLayoutEffect(() => {
    const el = phoneRef.current;
    const pos = pendingCaret.current;
    pendingCaret.current = null;
    if (el && pos !== null && document.activeElement === el) el.setSelectionRange(pos, pos);
  }, [caretTick]);

  function waitForTurnstile(timeoutMs: number): Promise<string | null> {
    if (turnstileToken.current) return Promise.resolve(turnstileToken.current);
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve(null), timeoutMs);
      tokenWaiters.current.push((t) => {
        window.clearTimeout(timer);
        resolve(t);
      });
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return; // no double submits
    setFormError(null);

    const [nameError, phoneError] = await Promise.all([
      validateField('fullName', fullName),
      validateField('phone', phone),
    ]);
    if (nameError || phoneError) {
      setErrors({ fullName: nameError, phone: phoneError });
      (nameError ? nameRef : phoneRef).current?.focus();
      return;
    }

    setBusy(true);
    const payloadKey = `${fullName.trim()}|${phone}`;
    try {
      // A previous attempt got no answer and the details changed → it must be a new submission.
      if (unansweredPayload.current && unansweredPayload.current !== payloadKey) {
        unansweredPayload.current = null;
        void refreshVerification().catch(() => undefined);
      }
      // Never let the security check hold an order hostage: the Turnstile script may be slow or
      // blocked (in-app browsers, VPNs, old phones). Wait a little, then send the order anyway —
      // the server accepts it marked "⚠️ check" instead of losing the customer.
      await Promise.race([prepare(), delay(6_000)]);
      // The id is set synchronously, even if the widget itself never loads.
      if (!verification.current) void refreshVerification().catch(() => undefined);

      setWaitingForCheck(!turnstileToken.current);
      const token = await waitForTurnstile(8_000);
      setWaitingForCheck(false);

      const fullPhone = `+998${phone.replace(/\D/g, '')}`;
      const { submissionId } = verification.current!;
      const [fingerprint, model, signals] = await Promise.all([deviceFingerprint(), deviceModel(), deviceSignals()]);
      const response = await submitLead({
        fullName,
        phone: fullPhone,
        submissionId,
        deviceId: deviceId(),
        fingerprint,
        deviceModel: model,
        signals,
        turnstileToken: token ?? undefined,
        // Either decoy filled is the same trap.
        [HONEYPOT_FIELD]: `${honeypotRef.current?.value ?? ''}${websiteRef.current?.value ?? ''}`.slice(0, 500),
        utm,
      });
      unansweredPayload.current = null;
      // The main site reports no Lead from here: the Worker does, once an operator has rung
      // the customer. Only the partner site sends one at once (see trackLead).
      if (response.status === 'accepted') trackLead(submissionId);
      submittedHere.current = true;
      setBusy(false);
      // The heading already says the order was received; for a new order the body only
      // adds what happens next. A repeat keeps the server's "already received" wording.
      const message = response.status === 'accepted' ? 'Раҳмат! Оператор тез орада сизга қўнғироқ қилади.' : response.message;
      onSuccess({ message, phone: formatUzPhone(fullPhone) });
    } catch (err) {
      setWaitingForCheck(false);
      setBusy(false);
      if (err instanceof ApiRequestError && err.code === 'network') {
        // The request may or may not have arrived. Keep the same tokens: if it did
        // arrive, the server answers a retry with the original result (idempotent).
        unansweredPayload.current = payloadKey;
        setFormError(err.message);
        return;
      }
      const apiErr = err instanceof ApiRequestError ? err : null;
      if (apiErr?.fields) {
        setErrors({ fullName: apiErr.fields.fullName, phone: apiErr.fields.phone });
        (apiErr.fields.fullName ? nameRef : phoneRef).current?.focus();
      }
      // Anything that is not one of our API answers (e.g. the security script was blocked).
      setFormError(apiErr ? (apiErr.fields ? null : apiErr.message) : CHECK_FAILED);
      // The server answered "no": start the next attempt with fresh, unused tokens.
      unansweredPayload.current = null;
      void refreshVerification().catch(() => {
        preparing.current = null;
      });
    }
  }

  const callButton = site.phone && site.phoneHref && (
    <a
      href={site.phoneHref}
      className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border-2 border-forest/25 px-4 py-2 font-display text-[1.05rem] font-bold text-forest transition-colors hover:border-forest/50 hover:bg-paper"
    >
      <PhoneIcon className="h-5 w-5 flex-none" />
      <span>
        Қўнғироқ қилиш: <span className="tabular-nums">{site.phone}</span>
      </span>
    </a>
  );

  if (completed) {
    return (
      <div className="pop-in rounded-3xl bg-card p-6 text-center text-ink shadow-[0_30px_60px_-30px_rgba(0,0,0,0.55)] sm:p-10">
        <svg viewBox="0 0 52 52" className="mx-auto h-16 w-16" aria-hidden="true">
          <circle cx="26" cy="26" r="25" fill="var(--color-accent)" />
          <path className="check-draw" d="M15 27l7 7 15-16" fill="none" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h3 ref={successRef} tabIndex={-1} className="mt-5 text-2xl font-bold tracking-tight outline-none">
          Сўровингиз қабул қилинди
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-lg text-ink-2" role="status">
          {completed.message}
        </p>
        <p className="mt-4 text-lg text-ink-2">
          Қўнғироқ қилинадиган рақам: <span className="font-bold text-ink tabular-nums">{completed.phone}</span>
        </p>
        <ol className="mx-auto mt-6 max-w-sm space-y-3 border-t border-line pt-5 text-left">
          {[
            'Телефонингизни ёнингизда сақланг: оператор 15 дақиқа ичида қўнғироқ қилади.',
            'Оператор саволларингизга жавоб беради ва бепул маслаҳат беради.',
            'Маҳсулотни олишга қарор қилсангиз, 1–3 кунда етказилади. Тўловни олганингизда қиласиз.',
          ].map((t, i) => (
            <li key={t} className="flex gap-3 text-[1.02rem] leading-snug">
              <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-forest font-display text-base font-extrabold text-accent" aria-hidden="true">
                {i + 1}
              </span>
              {t}
            </li>
          ))}
        </ol>
        {callButton && <div className="mx-auto mt-6 max-w-sm">{callButton}</div>}
      </div>
    );
  }

  const errorId = (f: Field) => `${id}-${f}-error`;

  // No autofill: customers keep the phone for years but change SIM cards, and the browser
  // would offer the old number (and the old name it was saved with). The field names are
  // neutral too, because Chrome guesses from "name"/"phone" even with autocomplete off.
  return (
    <form
      ref={formRef}
      autoComplete="off"
      noValidate
      onSubmit={onSubmit}
      onFocus={() => {
        trackInitiateCheckout();
        void prepare();
      }}
      className={cn(
        'relative min-w-0 rounded-3xl bg-card text-ink shadow-[0_30px_60px_-30px_rgba(0,0,0,0.55)]',
        compact ? 'p-5 sm:p-6' : 'p-5 sm:p-8',
      )}
      aria-describedby={`${id}-privacy`}
    >
      {compact && (
        <p className="mb-4 font-display text-xl font-extrabold leading-snug">
          Рақамингизни қолдиринг. <span className="text-brand">Консультация бепул.</span>
        </p>
      )}
      <div className={cn(compact ? 'grid grid-cols-1 gap-4 sm:grid-cols-2' : 'space-y-5')}>
        <div className="min-w-0">
          <label htmlFor={`${id}-name`} className="mb-2 block font-display text-lg font-bold">
            Исмингиз
          </label>
          <input
            ref={nameRef}
            id={`${id}-name`}
            name="zn-customer"
            type="text"
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            maxLength={80}
            required
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (errors.fullName) setErrors((x) => ({ ...x, fullName: undefined }));
            }}
            onBlur={() => void onBlur('fullName')}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? errorId('fullName') : undefined}
            className={cn(
              'block h-16 w-full min-w-0 rounded-2xl border-2 bg-paper px-4 text-xl outline-none transition-[border-color,background-color,box-shadow] focus:border-brand focus:bg-card focus:shadow-[0_0_0_4px_rgba(23,120,74,0.2)]',
              errors.fullName ? 'border-danger' : 'border-line',
            )}
          />
          {errors.fullName && (
            <p id={errorId('fullName')} className="mt-2 text-base font-semibold text-danger">
              {errors.fullName}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <label htmlFor={`${id}-phone`} className="mb-2 block font-display text-lg font-bold">
            Телефон рақамингиз
          </label>
          <div
            className={cn(
              'flex h-16 min-w-0 items-center rounded-2xl border-2 bg-paper transition-[border-color,background-color,box-shadow] focus-within:border-brand focus-within:bg-card focus-within:shadow-[0_0_0_4px_rgba(23,120,74,0.2)]',
              errors.phone ? 'border-danger' : 'border-line',
            )}
          >
            <span className="select-none border-r-2 border-line px-3.5 font-display text-xl font-bold tabular-nums text-ink-2" aria-hidden="true">
              +998
            </span>
            <input
              ref={phoneRef}
              id={`${id}-phone`}
              name="zn-number"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              enterKeyHint="send"
              required
              value={phone}
              onChange={onPhoneChange}
              onBlur={() => void onBlur('phone')}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? errorId('phone') : `${id}-phone-hint`}
              className="h-full min-w-0 flex-1 rounded-r-2xl bg-transparent px-3.5 text-xl tabular-nums tracking-wide outline-none"
            />
          </div>
          {errors.phone ? (
            <p id={errorId('phone')} className="mt-2 text-base font-semibold text-danger">
              {errors.phone}
            </p>
          ) : (
            <p id={`${id}-phone-hint`} className="mt-2 text-base text-muted">
              9 та рақам. Масалан: 90 123 45 67
            </p>
          )}
        </div>

        {/* Honeypot: invisible to people and screen readers; bots tend to fill every field. */}
        <div className="hp-field" aria-hidden="true">
          <label htmlFor={`${id}-fax`}>Бу майдонни бўш қолдиринг</label>
          <input ref={honeypotRef} id={`${id}-fax`} name="contact_fax" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        {/* A second decoy with the name form-filling scripts like most. Browsers never autofill it. */}
        <div className="hp-field" aria-hidden="true">
          <label htmlFor={`${id}-website`}>Сайтингиз манзили</label>
          <input ref={websiteRef} id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {/* Turnstile mounts here, and with appearance 'interaction-only' it usually stays empty
            and takes no height at all. No space is reserved for it: reserving 72–147 px of the
            form for something almost no visitor is shown cost more orders than the rare jump. */}
        <div ref={widgetBox} className="flex justify-center empty:hidden sm:col-span-2" />

        {formError && (
          <div role="alert" className="rounded-2xl bg-danger-bg px-4 py-3 text-base font-semibold text-danger sm:col-span-2">
            {formError}
          </div>
        )}

        <AntiMetalButton type="submit" busy={busy} disabled={busy} className="w-full sm:col-span-2">
          {busy ? (
            <>
              <svg className="spinner h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="42 100" strokeLinecap="round" />
              </svg>
              {waitingForCheck ? 'Текширилмоқда…' : 'Юборилмоқда…'}
            </>
          ) : (
            'Батафсил маълумот олиш'
          )}
        </AntiMetalButton>

        <p className="text-center text-[1.02rem] font-semibold text-ink-2 sm:col-span-2">
          Оператор 15 дақиқа ичида қўнғироқ қилиб, бепул маслаҳат беради.
        </p>

        <ul className={cn('grid gap-2 text-base font-semibold text-brand-2 sm:grid-cols-3', compact && 'hidden')}>
          {['Олдиндан тўлов йўқ', 'Бепул етказиб бериш', 'Маълумотлар сир сақланади'].map((t) => (
            <li key={t} className="flex items-center gap-2 sm:justify-center">
              <CheckIcon className="h-4 w-4 flex-none" />
              {t}
            </li>
          ))}
        </ul>

        {callButton && (
          <div className="sm:col-span-2">
            <p className="mb-2 text-center text-base text-muted">Ёзишга қийналсангиз, ўзингиз қўнғироқ қилинг:</p>
            {callButton}
          </div>
        )}

        <p id={`${id}-privacy`} className="text-center text-[0.95rem] leading-relaxed text-muted sm:col-span-2">
          Исмингиз ва рақамингиз фақат сиз билан боғланиш учун ишлатилади.
        </p>
      </div>
    </form>
  );
}
