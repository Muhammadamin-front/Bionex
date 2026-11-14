/**
 * Whether an order came from a server network — a hosting company, a cloud or a VPN — rather than a home
 * line or a mobile operator (owner, 2026-11-14). Scripts that post orders run on rented servers and VPNs;
 * a customer on an Uzbek operator's network does not. A warning only (`server_network`): no instant Lead,
 * the order stays in «Lidlar» for a call. VPNs are common in Uzbekistan (sites blocked there), so a real
 * customer can arrive this way too, and mobile proxies (an operator's own network) are not caught at all.
 *
 * Cloudflare names each request's network (`request.cf.asn` / `asOrganization`). An order through
 * zeynara.com.uz reaches this Worker over a service binding, without the customer's `cf`; the domain's
 * Pages function sends it along as `x-bx-asn` / `x-bx-as-org` (apps/site/functions/api/[[path]].ts).
 */

/** Well-known hosting, cloud and VPN networks (autonomous system numbers). */
const HOSTING_ASNS = new Set([
  16509, 14618, 8987, // Amazon AWS
  15169, 396982, 19527, // Google, Google Cloud
  8075, // Microsoft / Azure
  14061, // DigitalOcean
  24940, 213230, // Hetzner
  16276, // OVH
  63949, // Linode (Akamai cloud)
  20473, // Vultr / Choopa
  51167, // Contabo
  45102, 37963, // Alibaba Cloud
  132203, 45090, // Tencent Cloud
  31898, // Oracle Cloud
  12876, // Scaleway
  9009, // M247 (VPN services)
  60068, 212238, // Datacamp / CDN77 (VPN services)
  60781, 28753, // Leaseweb
  136787, // Tefincom (NordVPN)
  207990, // HostRoyale (VPN services)
  199524, // G-Core Labs
  202425, // IP Volume
  49981, // WorldStream
  43350, // NForce
  210644, // Aeza
  44477, // Stark Industries
  36352, // ColoCrossing
  53667, // FranTech / BuyVM
  62240, // Clouvider
  47583, // Hostinger
  8560, // IONOS
  49505, // Selectel
  9123, // Timeweb
  200350, // Yandex Cloud
]);

/** Names that give a server network away when its number is not in the list above. */
const HOSTING_NAME = /\b(hosting|host|server|servers|data ?cent(?:er|re)|vps|cloud|colo(?:cation)?|dedicated|vpn|proxy)\b/i;

/**
 * Never counted, whatever their names say: Cloudflare (its WARP app, and the address a binding's request
 * may carry), and the partners of Apple's iCloud Private Relay (an iPhone's Safari), a privacy feature of
 * ordinary customers, not a server.
 */
const NEVER = new Set([13335, 209242, 714, 6185, 20940, 16625, 36183, 54113]);
const NEVER_NAME = /cloudflare|akamai|fastly|apple/i;

export interface Network {
  asn?: number;
  org?: string;
}

/** The network a request came from: its own `cf`, or, for an order forwarded by zeynara.com.uz, the headers the domain added. */
export function networkOf(request: Request): Network {
  const cf = (request as Request & { cf?: { asn?: unknown; asOrganization?: unknown } }).cf;
  const asn = typeof cf?.asn === 'number' && cf.asn > 0 ? cf.asn : undefined;
  const fromHeader = Number(request.headers.get('x-bx-asn'));
  // A forwarded order has no customer `cf` (or Cloudflare's own): the domain's headers say it. A direct post
  // always has its real `cf`, so headers made up by a script there are never read.
  if ((asn === undefined || NEVER.has(asn)) && Number.isInteger(fromHeader) && fromHeader > 0) {
    let org: string | undefined;
    try {
      org = decodeURIComponent(request.headers.get('x-bx-as-org') ?? '') || undefined;
    } catch {
      org = undefined;
    }
    return { asn: fromHeader, org };
  }
  return { asn, org: typeof cf?.asOrganization === 'string' ? cf.asOrganization : undefined };
}

/** The server network's name (or number) when the order came from one; null for a home or mobile line. */
export function serverNetwork({ asn, org }: Network): string | null {
  if (asn !== undefined && NEVER.has(asn)) return null;
  if (org && NEVER_NAME.test(org)) return null;
  if ((asn !== undefined && HOSTING_ASNS.has(asn)) || (org && HOSTING_NAME.test(org))) return org || `AS${asn}`;
  return null;
}
