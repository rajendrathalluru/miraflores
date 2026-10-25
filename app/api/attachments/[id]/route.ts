import { getLocalBucket } from '@/lib/local-storage';
import { requestContext, database, failure, HttpError } from '@/lib/server';
import { maskSensitiveText } from '@/lib/packet';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { ownerId, actor } = await requestContext();
    if (!actor.clearance) throw new HttpError(403, 'Original attachments may contain sensitive data. Use a cleared staff role to download them.');
    const { id } = await context.params;
    const file = await database().prepare('SELECT name, object_key, content_type FROM attachments WHERE id = ? AND owner_id = ?').bind(id, ownerId).first<{ name: string; object_key: string; content_type: string }>();
    if (!file) throw new HttpError(404, 'Attachment not found.');
    const object = await getLocalBucket().get(file.object_key);
    if (!object) throw new HttpError(404, 'Attachment file is unavailable.');
    await database().prepare('INSERT INTO sensitive_views (id, owner_id, actor_id, target_id, viewed_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), ownerId, actor.id, id, new Date().toISOString()).run();
    const preview = new URL(request.url).searchParams.get('preview') === '1' && ['application/pdf', 'image/png', 'image/jpeg'].includes(file.content_type);
    return new Response(object.body as ReadableStream, { headers: { 'Content-Type': preview ? file.content_type : 'application/octet-stream', 'Content-Disposition': `${preview ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(maskSensitiveText(file.name))}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'" } });
  } catch (e) { return failure(e); }
}
