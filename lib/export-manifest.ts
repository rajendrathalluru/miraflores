/** SERVER ONLY. Select evidence against a captured review state before any blob I/O. */
import { createHash } from 'node:crypto';
import type { Workspace } from './contracts';
import type { EncryptedIdentifier } from './identifiers';

export interface ExportAttachmentRow { id: string; owner_id: string; name: string; object_key: string; size: number }
export interface ExportAttachment extends ExportAttachmentRow { sha256: string }
export interface ExportManifest {
  state: Workspace;
  attachments: ExportAttachment[];
  corrections: EncryptedIdentifier[];
}
export class ExportManifestError extends Error {}
function invalid(message: string): never { throw new ExportManifestError(`Export revision is inconsistent: ${message}`); }

/** Rows and state must come from the same short database read snapshot. The copied
 * manifest remains stable while later uploads/corrections commit and bytes load. */
export function captureExportManifest(state: Workspace, ownerId: string, files: ExportAttachmentRow[], corrections: EncryptedIdentifier[]): ExportManifest {
  const captured = structuredClone(state);
  const fileRows = new Map(files.map(file => [file.id, file]));
  const correctionRows = new Map(corrections.map(record => [record.id, record]));
  if (fileRows.size !== files.length || correctionRows.size !== corrections.length) invalid('duplicate private evidence IDs.');
  const attachmentIds = new Set<string>();
  const attachments = (captured.workpaper?.attachments || []).map(entry => {
    if (attachmentIds.has(entry.id)) invalid('duplicate referenced attachment.');
    attachmentIds.add(entry.id);
    const file = fileRows.get(entry.id);
    if (!file || file.owner_id !== ownerId) invalid(`referenced original ${entry.id} is unavailable.`);
    if (typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) invalid(`original ${entry.id} has no recorded evidence hash.`);
    if (!Number.isSafeInteger(file.size) || file.size < 0 || entry.size !== file.size || entry.name !== file.name) invalid(`original ${entry.id} metadata changed.`);
    return { ...file, sha256: entry.sha256 };
  });
  const correctionIds = new Set<string>();
  const selectedCorrections = (captured.workpaper?.identifierCorrections || []).map(entry => {
    if (correctionIds.has(entry.id)) invalid('duplicate referenced correction.');
    correctionIds.add(entry.id);
    const record = correctionRows.get(entry.id);
    if (!record || record.owner_id !== ownerId || record.ref !== entry.ref || record.actor_id !== entry.actorId) invalid(`protected correction ${entry.id} is unavailable or changed.`);
    return { ...record };
  });
  // Unreferenced rows, including work committed after the selected state, never
  // enter the manifest. Missing referenced rows fail rather than reducing scope.
  return { state: captured, attachments, corrections: selectedCorrections };
}

export function verifyExportBytes(file: Pick<ExportAttachment, 'id' | 'size' | 'sha256'>, bytes: Uint8Array): void {
  if (bytes.byteLength !== file.size || createHash('sha256').update(bytes).digest('hex') !== file.sha256) {
    invalid(`original ${file.id} no longer matches its recorded bytes.`);
  }
}
