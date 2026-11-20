// The concern list alone, without zod: the page imports only this, so the order schema (and zod) stays in its
// own chunk that loads when the form is sent, not with the page.
/**
 * «Сизни нима безовта қилади?» — the optional question on the thank-you screen (main site,
 * 2026-10-30): asked after the order is in, so it costs no orders; the answer helps the operator
 * open the call. Cyrillic for the page and Telegram, Latin for the Google Sheet.
 */
export const CONCERNS = {
  pressure: { cyrl: 'Қон босими', latn: 'Qon bosimi' },
  heart: { cyrl: 'Юрак', latn: 'Yurak' },
  head: { cyrl: 'Бош оғриғи, бош айланиши', latn: "Bosh og'rig'i, bosh aylanishi" },
  vessels: { cyrl: 'Холестерин, томирлар', latn: 'Xolesterin, tomirlar' },
  numbness: { cyrl: 'Қўл-оёқ увишиши', latn: "Qo'l-oyoq uvishishi" },
  other: { cyrl: 'Бошқа', latn: 'Boshqa' },
} as const;

export type ConcernId = keyof typeof CONCERNS;
export const CONCERN_IDS = Object.keys(CONCERNS) as ConcernId[];
