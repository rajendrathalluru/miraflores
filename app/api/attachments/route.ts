import { getLocalBucket } from '@/lib/local-storage';
import { masked, maskSensitiveText } from '@/lib/packet';
import { requestContext, database, failure, json, HttpError } from '@/lib/server';
const ALLOWED = new Set(['application/pdf','image/png','image/jpeg','text/plain','text/csv','application/json']);

export async function POST(request: Request) {
  try {
    const { ownerId } = await requestContext(true);
    const bucket = getLocalBucket();
    if (Number(request.headers.get('content-length') || 0) > 8_500_000) throw new HttpError(413, 'Choose a file smaller than 8 MB.');
    const form = await request.formData();
    const file = form.get('file');
    const issueId = String(form.get('issueId') || '').slice(0,100) || null;
    if (!(file instanceof File) || file.size > 8_000_000 || !ALLOWED.has(file.type)) throw new HttpError(400, 'Upload a PDF, PNG, JPEG, text, CSV or JSON file under 8 MB.');
    const id = crypto.randomUUID();
    const objectKey = `attachments/${encodeURIComponent(ownerId)}/${id}`;
    const name = maskSensitiveText(file.name.replace(/[\x00-\x1f<>]/g,'').slice(0,160));
    await bucket.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    try {
      await database().prepare('INSERT INTO attachments (id, owner_id, name, object_key, content_type, size, issue_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, ownerId, name, objectKey, file.type, file.size, issueId, new Date().toISOString()).run();
    } catch (e) { await bucket.delete(objectKey); throw e; }
    return json({ id, name, size: file.size, issueId }, 201);
  } catch (e) { return failure(e); }
}

export async function GET() {
  try {
    const { ownerId } = await requestContext();
    const rows = await database().prepare('SELECT id, name, content_type AS contentType, size, issue_id AS issueId, created_at AS createdAt FROM attachments WHERE owner_id = ? ORDER BY created_at DESC').bind(ownerId).all();
    return json(masked({ attachments: rows.results }));
  } catch (e) { return failure(e); }
}
