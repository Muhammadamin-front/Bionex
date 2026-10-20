/**
 * The landing sites that take orders.
 *
 * 'main' is this Worker's own site. 't2' is the same page published a second time on
 * Cloudflare Pages (apps/partner) for an outside targetologist's ads: it carries only that
 * person's Pixel, and its orders reach this Worker through a service binding (`PartnerSite`
 * in index.ts) that the public internet cannot call. Its orders are that person's alone:
 * they go to their Google Sheet and their Meta dataset, never to the operators' group, panel
 * or reports (registry.ts `acceptPartner`, docs/PARTNER-SITE.md).
 */
export type SiteId = 'main' | 't2';
