/**
 * Every /api/* request on zeynara.com.uz. Only the order form's POST /api/leads (and the thank-you
 * screen's POST /api/leads/concern and /api/leads/region) exist here: each is
 * handed to the main Worker over the MAIN service binding as a post to the Worker's own address
 * (MAIN_ORIGIN) — the customer's IP, user agent and _fbp/_fbc cookies unchanged — so the Worker
 * treats it exactly like an order from its own page. The operators' panel, the bot's webhook and
 * the health check stay on the Worker's address.
 */

interface Env {
  MAIN: { fetch(request: Request): Promise<Response> };
  MAIN_ORIGIN: string;
}

const FORWARDED = new Set(['/api/leads', '/api/leads/concern', '/api/leads/region']);

const notFound = () =>
  new Response(JSON.stringify({ error: { code: 'not_found', message: 'Топилмади.' } }), {
    status: 404,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export const onRequest = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const url = new URL(request.url);
  if (!FORWARDED.has(url.pathname) || request.method !== 'POST') return notFound();
  // Only this site's own page may post here (the Worker's check, done before its Origin is rewritten).
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) {
    return new Response(JSON.stringify({ error: { code: 'forbidden', message: 'Рухсат йўқ.' } }), {
      status: 403,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  const headers = new Headers(request.headers);
  if (origin) headers.set('origin', env.MAIN_ORIGIN);
  // The customer's network, which the Worker cannot see over the binding (worker/src/network.ts: an order from a
  // server or VPN network is a warning). Whatever a visitor sent under these names is dropped first.
  headers.delete('x-bx-asn');
  headers.delete('x-bx-as-org');
  const cf = (request as Request & { cf?: { asn?: unknown; asOrganization?: unknown } }).cf;
  if (typeof cf?.asn === 'number') headers.set('x-bx-asn', String(cf.asn));
  if (typeof cf?.asOrganization === 'string') headers.set('x-bx-as-org', encodeURIComponent(cf.asOrganization.slice(0, 100)));
  return env.MAIN.fetch(new Request(`${env.MAIN_ORIGIN}${url.pathname}`, { method: 'POST', headers, body: await request.arrayBuffer() }));
};
