import { requestContext, database, failure, HttpError } from '@/lib/server';
import { loadWorkspace } from '@/lib/repository';
import { getLocalBucket } from '@/lib/local-storage';
import { examinationPackage, type PackagedAttachment } from '@/lib/packages';
import { decryptCorrection, getSensitiveSource, type EncryptedIdentifier } from '@/lib/identifiers';
export async function GET() {
  try {
    const { ownerId, actor } = await requestContext();
    if (actor.role === 'client') throw new HttpError(403, 'The examination record is available to the firm team.');
    const state = await loadWorkspace(ownerId);
    const rows = await database().prepare('SELECT id, name, object_key, size FROM attachments WHERE owner_id = ? ORDER BY created_at').bind(ownerId).all<{ id: string; name: string; object_key: string; size: number }>();
    const corrections = await database().prepare('SELECT id, owner_id, actor_id, ref, ciphertext, iv, tag, created_at FROM identifier_corrections WHERE owner_id = ? ORDER BY rowid').bind(ownerId).all<EncryptedIdentifier>();
    if ((rows.results.length || corrections.results.length) && !actor.clearance) throw new HttpError(403, 'Clearance is required to include private original files and protected corrections in the examination record.');
    if (rows.results.reduce((n, r) => n + r.size, 0) > 64_000_000) throw new HttpError(413, 'Original attachments exceed the 64 MB package limit. Prepare a scoped examination record.');
    const originals: PackagedAttachment[] = [];
    for (const file of rows.results) {
      const object = await getLocalBucket().get(file.object_key);
      if (!object) throw new HttpError(409, `Original file ${file.id} is unavailable; package generation stopped.`);
      const bytes = await new Response(object.body).arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const expectedHash = state.workpaper?.attachments.find(a => a.id === file.id)?.sha256;
      if (expectedHash && expectedHash !== Buffer.from(digest).toString('hex')) throw new HttpError(409, `Original file ${file.id} no longer matches its recorded evidence hash.`);
      originals.push({ id: file.id, name: file.name, size: file.size, sha256: Buffer.from(digest).toString('hex'), base64: Buffer.from(bytes).toString('base64') });
      await database().prepare('INSERT INTO sensitive_views (id, owner_id, actor_id, target_id, viewed_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), ownerId, actor.id, file.id, new Date().toISOString()).run();
    }
    if (corrections.results.length) {
      const evidence = [];
      for (const record of corrections.results) {
        evidence.push({ id: record.id, actorId: record.actor_id, ref: record.ref, value: await decryptCorrection(record), createdAt: record.created_at,
          originalSource: getSensitiveSource(actor.id, record.ref) });
        await database().prepare('INSERT INTO sensitive_views (id, owner_id, actor_id, target_id, viewed_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), ownerId, actor.id, `correction:${record.id};examination-export`, new Date().toISOString()).run();
      }
      // Corrected values travel only as a clearance-gated, explicitly downloadable
      // private evidence file. Passive review JSON and rendered text remain masked.
      const bytes = Buffer.from(JSON.stringify({ format: 'protected-identifier-evidence-v1', corrections: evidence }, null, 2));
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      originals.push({ id: 'protected-identifier-evidence', name: 'protected-identifier-evidence.json', size: bytes.length, sha256: Buffer.from(hash).toString('hex'), base64: bytes.toString('base64') });
    }
    const html = await examinationPackage(state, originals);
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="miraflores-examination-r${state.revision}.html"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (e) { return failure(e); }
}
