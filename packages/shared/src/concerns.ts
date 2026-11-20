import { z } from 'zod';
import { SUBMISSION_ID_PATTERN } from './lead';

export { CONCERNS, CONCERN_IDS, type ConcernId } from './concern-list';
import { CONCERN_IDS, type ConcernId } from './concern-list';

export const concernAnswerSchema = z.strictObject({
  submissionId: z.string().regex(SUBMISSION_ID_PATTERN),
  concerns: z
    .array(z.enum(CONCERN_IDS as [ConcernId, ...ConcernId[]]))
    .min(1)
    .max(CONCERN_IDS.length)
    .transform((list) => [...new Set(list)]),
});

/**
 * «Қайси вилоятдансиз?» — asked first on the same screen (2026-11-05): one tap, after the order is
 * in, so it costs no orders and the operator knows the region before the call. The 12 regions,
 * Tashkent city and Karakalpakstan.
 */
export const REGIONS = {
  tashkent_city: { cyrl: 'Тошкент шаҳри', latn: 'Toshkent shahri' },
  tashkent: { cyrl: 'Тошкент вилояти', latn: 'Toshkent viloyati' },
  andijan: { cyrl: 'Андижон', latn: 'Andijon' },
  bukhara: { cyrl: 'Бухоро', latn: 'Buxoro' },
  jizzakh: { cyrl: 'Жиззах', latn: 'Jizzax' },
  kashkadarya: { cyrl: 'Қашқадарё', latn: 'Qashqadaryo' },
  navoi: { cyrl: 'Навоий', latn: 'Navoiy' },
  namangan: { cyrl: 'Наманган', latn: 'Namangan' },
  samarkand: { cyrl: 'Самарқанд', latn: 'Samarqand' },
  syrdarya: { cyrl: 'Сирдарё', latn: 'Sirdaryo' },
  surkhandarya: { cyrl: 'Сурхондарё', latn: 'Surxondaryo' },
  fergana: { cyrl: 'Фарғона', latn: "Farg'ona" },
  khorezm: { cyrl: 'Хоразм', latn: 'Xorazm' },
  karakalpakstan: { cyrl: 'Қорақалпоғистон', latn: "Qoraqalpog'iston" },
} as const;

export type RegionId = keyof typeof REGIONS;
export const REGION_IDS = Object.keys(REGIONS) as RegionId[];

export const regionAnswerSchema = z.strictObject({
  submissionId: z.string().regex(SUBMISSION_ID_PATTERN),
  region: z.enum(REGION_IDS as [RegionId, ...RegionId[]]),
});
