/**
 * Every /api/* request on zeynara.com.uz. Only the order form's POST /api/leads (and the thank-you
 * screen's POST /api/leads/concern) exist here: each is
 * handed to the main Worker over the MAIN service binding as a post to the Worker's own address
 * (MAIN_ORIGIN) — the customer's IP, user agent and _fbp/_fbc cookies unchanged — so the Worker
 * treats it exactly like an order from its own page. The operators' panel, the bot's webhook and
 * the health check stay on the Worker's address.
 */

interface Env {
  MAIN: { fetch(request: Request): Promise<Response> };
  MAIN_ORIGIN: string;
}

const notFound = () =>
  new Response(JSON.stringify({ error: { code: 'not_found', message: 'Топилмади.' } }), {
    status: 404,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export const onRequest = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const url = new URL(request.url);
  if ((url.pathname !== '/api/leads' && url.pathname !== '/api/leads/concern') || request.method !== 'POST') return notFound();
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
  return env.MAIN.fetch(new Request(`${env.MAIN_ORIGIN}${url.pathname}`, { method: 'POST', headers, body: await request.arrayBuffer() }));
};
