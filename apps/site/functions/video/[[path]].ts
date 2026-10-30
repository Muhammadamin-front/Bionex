/**
 * The customer videos, from this site's own files, with byte ranges: an iPhone (Safari, and the
 * Instagram app there) plays nothing from a server that answers a Range request with the whole file.
 * The same code as the Worker's (apps/worker/src/video.ts).
 */
import { serveVideo } from '../../../worker/src/video';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export const onRequest = ({ request, env }: { request: Request; env: Env }): Promise<Response> =>
  serveVideo(request, env as unknown as Parameters<typeof serveVideo>[1]);
