/**
 * Every /api/* request on the partner site. Only the order form's POST /api/leads exists: it
 * goes, unchanged (the customer's IP, user agent and _fbp/_fbc cookies included), to the main
 * Worker's PartnerSite entrypoint over the MAIN service binding, which also refuses anything
 * but a POST. The operators' panel, the bot's webhook and the health check are not here.
 */

interface Env {
  MAIN: { fetch(request: Request): Promise<Response> };
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (new URL(request.url).pathname === '/api/leads') return env.MAIN.fetch(request);
  return new Response(JSON.stringify({ error: { code: 'not_found', message: 'Топилмади.' } }), {
    status: 404,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
};
