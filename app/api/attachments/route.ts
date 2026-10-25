import { getLocalBucket } from '@/lib/local-storage';
import { masked, maskSensitiveText } from '@/lib/packet';
import { requestContext, database, failure, json, HttpError } from '@/lib/server';
import { executeCommand } from '@/lib/repository';

export async function POST(request: Request) {
  try {
    const { ownerId, actor } = await requestContext(true);
    if (!['preparer', 'reviewer', 'partner', 'quality_reviewer'].includes(actor.role)) throw new HttpError(403, 'Only tax staff can attach evidence.');
    const bucket = getLocalBucket();
    if (Number(request.headers.get('content-length') || 0) > 8_500_000) throw new HttpError(413, 'Choose a file smaller than 8 MB.');
    const form = await request.formData();
    const file = form.get('file');
    const issueId = String(form.get('issueId') || '').slice(0,100) || null;
    const expectedRevision = Number(form.get('expectedRevision'));
    if (form.get('expectedRevision') === null || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new HttpError(400, 'An expected workspace revision is required.');
    if (!(file instanceof File) || file.size > 8_000_000) throw new HttpError(400, 'Upload a file under 8 MB.');
    const id = crypto.randomUUID();
    const objectKey = `attachments/${encodeURIComponent(ownerId)}/${id}`;
    const name = maskSensitiveText(file.name.replace(/[\x00-\x1f<>]/g,'').slice(0,160)) || 'Evidence attachment';
    const contentType = file.type || 'application/octet-stream';
    const bytes = await file.arrayBuffer();
    const sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
    await bucket.put(objectKey, bytes, { httpMetadata: { contentType: file.type } });
    try {
      await executeCommand(ownerId, actor.id, expectedRevision, { type: 'workflow', action: 'attach_evidence',
        payload: { id, name, contentType, size: file.size, issueId, sha256 } }, { id, name, contentType, size: file.size, issueId, objectKey });
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
