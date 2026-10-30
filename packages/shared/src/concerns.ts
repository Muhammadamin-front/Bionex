import { z } from 'zod';
import { SUBMISSION_ID_PATTERN } from './lead';

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

export const concernAnswerSchema = z.strictObject({
  submissionId: z.string().regex(SUBMISSION_ID_PATTERN),
  concerns: z
    .array(z.enum(CONCERN_IDS as [ConcernId, ...ConcernId[]]))
    .min(1)
    .max(CONCERN_IDS.length)
    .transform((list) => [...new Set(list)]),
});
