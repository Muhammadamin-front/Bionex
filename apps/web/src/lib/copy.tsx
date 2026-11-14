// Wording one site may change without touching the others'. The main site provides it (sites/classic/copy.ts,
// 2026-11-14: «буюртма» put older visitors off, «бепул маслаҳат» drew price-askers,
// and many left a wrong number); the partner and the workers.dev
// test page provide nothing and keep every original text.
import { createContext, useContext } from 'react';

export interface PageCopy {
  /** The forms' send button. */
  submit: string;
  /** The buttons in the page's sections that lead to the form. */
  sectionButton: string;
  /** The phones' bottom bar button. */
  bar: string;
  /** The line under every form's send button. */
  underButton: string;
  /** Read the number back once all 9 digits are in, before sending ("+998 90 123 45 67"). */
  numberCheck: (phone: string) => string;
  /** The thank-you screen: in place of the server's «Буюртмангиз қабул қилинди…», and its first step. */
  thanks: { accepted: string; duplicate: string; firstStep: string };
  /** The bottom section: its heading, the steps' heading and the steps. */
  urgencyTitle: string;
  stepsTitle: string;
  steps: string[];
  /** FAQ answers to replace, by the original question. */
  faq: Record<string, { q: string; a: string }>;
}

export const PageCopyContext = createContext<PageCopy | null>(null);

export const usePageCopy = () => useContext(PageCopyContext);
