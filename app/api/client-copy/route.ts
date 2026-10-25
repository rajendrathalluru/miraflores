import { requestContext, failure } from '@/lib/server';
import { loadWorkspace } from '@/lib/repository';
import { clientCopy } from '@/lib/packages';
export async function GET() {
  try {
    const { ownerId } = await requestContext();
    const state = await loadWorkspace(ownerId);
    return new Response(clientCopy(state), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="miraflores-client-copy-r${state.revision}.html"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (e) { return failure(e); }
}
