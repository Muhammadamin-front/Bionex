import { describe, expect, it } from 'vitest';
import {
  caretAfterDigits,
  formatNationalAsTyped,
  nationalDigitsFromInput,
  formatUzPhone,
  makeLeadSubmissionSchema,
  maskUzPhone,
  normalizeName,
  normalizeUzPhone,
  phoneLooksSynthetic,
  sanitizeUtm,
} from './index';

describe('normalizeUzPhone', () => {
  it.each([
    ['+998 90 123 45 67', '+998901234567'],
    ['998901234567', '+998901234567'],
    ['+998 (90) 123-45-67', '+998901234567'],
    ['90 123 45 67', '+998901234567'],
    ['901234567', '+998901234567'],
    ['8 (90) 123 45 67', '+998901234567'],
    ['00998901234567', '+998901234567'],
    ['+998 33 555 44 33', '+998335554433'],
    ['+998 87 555 44 33', '+998875554433'],
    ['＋９９８９０１２３４５６７', '+998901234567'], // full-width digits
  ])('normalizes %s', (input, expected) => {
    const r = normalizeUzPhone(input);
    expect(r).toEqual({ ok: true, e164: expected, national: expected.slice(4) });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['12345', 'invalid_length'],
    ['+7 901 234 56 78', 'invalid_length'],
    ['+1 202 555 0123', 'invalid_length'],
    ['+998 90 123 45 6', 'invalid_length'],
    ['+998 90 123 45 678', 'invalid_length'],
    ['+998 01 123 45 67', 'invalid_length'],
    ['+998 40 123 45 67', 'invalid_prefix'],
    ['90 123 45 6a', 'invalid_chars'],
    ['90123456<script>', 'invalid_chars'],
    ['+998 90 123+45 67', 'invalid_chars'],
    ['1'.repeat(40), 'too_long'],
  ])('rejects %j with %s', (input, reason) => {
    expect(normalizeUzPhone(input)).toEqual({ ok: false, reason });
  });

  it('honours a custom prefix allowlist', () => {
    expect(normalizeUzPhone('40 123 45 67', ['40']).ok).toBe(true);
    expect(normalizeUzPhone('90 123 45 67', ['40']).ok).toBe(false);
  });

  it('formats and masks', () => {
    expect(formatUzPhone('+998901234567')).toBe('+998 90 123 45 67');
    expect(maskUzPhone('+998901234567')).toBe('+998 90 *** ** 67');
    expect(formatNationalAsTyped('901234')).toBe('90 123 4');
    expect(formatNationalAsTyped('9012345678999')).toBe('90 123 45 67');
  });

  it('flags synthetic-looking numbers without rejecting them', () => {
    expect(phoneLooksSynthetic('901111111')).toBe(true);
    expect(phoneLooksSynthetic('901234567')).toBe(true);
    expect(phoneLooksSynthetic('901234568')).toBe(false);
  });
});

describe('nationalDigitsFromInput (what people type into the +998 field)', () => {
  it.each([
    ['90 123 45 67', '901234567', 0],
    ['+998 90 123 45 67', '901234567', 3],
    ['998901234567', '901234567', 3],
    ['8 90 123 45 67', '901234567', 1], // old domestic prefix
    ['8 (90) 123-45-67', '901234567', 1],
    ['8 88 123 45 67', '881234567', 1], // legacy 8 + Mobiuz 88
    ['88 123 45 67', '881234567', 0], // a real 88 number is kept
    ['8812345671', '881234567', 0], // 88 number + accidental extra digit: keep, do not shift
    ['89012345', '89012345', 0], // still typing: nothing dropped yet
    ['90 123 45 67 89', '901234567', 0], // too long: extra digits ignored
    ['９０１２３４５６７', '901234567', 0], // full-width digits
  ])('%j → %s', (raw, digits, dropped) => {
    expect(nationalDigitsFromInput(raw)).toEqual({ digits, dropped });
  });

  it('places the caret after the n-th digit, skipping spaces', () => {
    expect(caretAfterDigits('90 123 45 67', 0)).toBe(0);
    expect(caretAfterDigits('90 123 45 67', 2)).toBe(2);
    expect(caretAfterDigits('90 123 45 67', 3)).toBe(4);
    expect(caretAfterDigits('90 123 45 67', 9)).toBe(12);
    expect(caretAfterDigits('90 1', 5)).toBe(4);
  });
});

describe('normalizeName', () => {
  it.each([
    ['  Aziza   Karimova ', 'Aziza Karimova'],
    ['Gʻayrat Oʻtkirov', 'Gʻayrat Oʻtkirov'],
    ["G'ayrat O'tkirov", "G'ayrat O'tkirov"],
    ['Анна-Мария', 'Анна-Мария'],
    ['Sh. Rashidov', 'Sh. Rashidov'],
    ['Ғайрат Ўткиров', 'Ғайрат Ўткиров'],
    ['Муҳаббат Қодирова', 'Муҳаббат Қодирова'],
    ['Li', 'Li'],
  ])('accepts %j', (input, expected) => {
    expect(normalizeName(input)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ['', 'empty'],
    ['A', 'too_short'],
    ['A.', 'too_short'],
    ['Ali123', 'invalid_chars'],
    ['http://spam.example', 'invalid_chars'],
    ['Ali 😀', 'invalid_chars'],
    ['=HYPERLINK("x")', 'invalid_chars'],
    ['-Ali', 'invalid_chars'],
    ['Ali\u0000', 'invalid_chars'],
    ['A'.repeat(81), 'too_long'],
  ])('rejects %j with %s', (input, reason) => {
    expect(normalizeName(input)).toEqual({ ok: false, reason });
  });
});

describe('sanitizeUtm', () => {
  it('keeps known keys, strips formula prefixes and odd characters', () => {
    expect(
      sanitizeUtm({
        source: 'instagram',
        medium: '=cpc',
        campaign: 'kuz<script>2026',
        content: '   ',
        term: 'ignored',
      }),
    ).toEqual({ source: 'instagram', medium: 'cpc', campaign: 'kuzscript2026' });
  });

  it('truncates long values', () => {
    expect(sanitizeUtm({ source: 'a'.repeat(400) }).source).toHaveLength(150);
  });
});

describe('lead submission schema', () => {
  const schema = makeLeadSubmissionSchema();
  const valid = {
    fullName: ' Aziza  Karimova ',
    phone: '90 123 45 67',
    submissionId: '3f2c1d4e-5b6a-4c7d-8e9f-0a1b2c3d4e5f',
    turnstileToken: 'token',
    utm: { source: 'facebook' },
  };

  it('normalizes a valid payload', () => {
    const r = schema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      fullName: 'Aziza Karimova',
      phone: '+998901234567',
      utm: { source: 'facebook' },
    });
  });

  it('requires a well-formed submission id', () => {
    expect(schema.safeParse({ ...valid, submissionId: 'abc' }).success).toBe(false);
    expect(schema.safeParse({ ...valid, submissionId: undefined }).success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(schema.safeParse({ ...valid, isAdmin: true }).success).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(schema.safeParse({ ...valid, phone: 901234567 }).success).toBe(false);
    expect(schema.safeParse({ ...valid, fullName: ['a'] }).success).toBe(false);
  });

  it('reports field messages in Uzbek', () => {
    const r = schema.safeParse({ ...valid, phone: '123' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['phone']);
    expect(r.error?.issues[0]?.message).toMatch(/нотўғри/);
  });
});
