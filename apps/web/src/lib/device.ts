import { newSubmissionId } from './api';

const KEY = 'bx_device';

/**
 * A random id this browser keeps, sent with every order, so that an order marked spam also
 * marks the phone it came from: the next order from it arrives flagged even after it changes
 * network (docs/SPAM.md). Not a fingerprint — it is only what this site stored, and clearing
 * the site's data or a private window makes a new one. Missing when storage is blocked; the
 * order goes through regardless.
 */
export function deviceId(): string | undefined {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
      id = newSubmissionId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}
