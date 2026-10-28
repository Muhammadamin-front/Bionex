/**
 * The site's videos (apps/web builds them into /video/), served with byte ranges. Static assets
 * answer a Range request with the whole file (200); Safari on an iPhone — and the Instagram app's
 * browser there — asks for `bytes=0-1` first and plays nothing unless it gets a 206 back.
 * The files are a few MB, so the slice is cut from the whole body in memory.
 */
export async function serveVideo(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  // The asset itself, never ranged: the slice is made here.
  const asset = await env.ASSETS.fetch(new Request(request.url, { method: 'GET' }));
  if (!asset.ok) return asset;
  const body = await asset.arrayBuffer();
  const size = body.byteLength;
  const headers = new Headers(asset.headers);
  headers.set('accept-ranges', 'bytes');
  headers.delete('content-encoding');

  const range = parseRange(request.headers.get('range'), size);
  if (range === 'invalid') {
    headers.set('content-range', `bytes */${size}`);
    headers.delete('content-length');
    return new Response(null, { status: 416, headers });
  }
  const [start, end] = range ?? [0, size - 1];
  headers.set('content-length', String(end - start + 1));
  if (range) headers.set('content-range', `bytes ${start}-${end}/${size}`);
  const slice = request.method === 'HEAD' ? null : range ? body.slice(start, end + 1) : body;
  return new Response(slice, { status: range ? 206 : 200, headers });
}

/** One range of «bytes=a-b», «bytes=a-» or «bytes=-n»; null when there is none (the whole file). */
export function parseRange(header: string | null, size: number): [number, number] | null | 'invalid' {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null; // several ranges or junk: send it all
  let start: number;
  let end: number;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (suffix === 0) return 'invalid';
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return 'invalid';
  return [start, end];
}
