/** Plain constants shared by browser and server. No Zod here, so importing them is free. */

/** Name of the hidden honeypot field. Real users never see or fill it. */
export const HONEYPOT_FIELD = 'contactFax';

/** Turnstile `action` — the server rejects tokens issued for any other action. */
export const TURNSTILE_ACTION = 'lead-submit';
