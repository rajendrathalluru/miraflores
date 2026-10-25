/** SERVER ONLY. Explicit sensitive reads and encrypted identifier corrections.
 * Plaintext corrected values never enter the public workspace or its audit. */
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { link, lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import packetJson from '../data/packet.json';
import { getActor, maskSensitiveText } from './packet';

interface IdentifierValue { id: string; document_id: string; page: number; field: string; label: string;
  value_type: string; value: unknown; text_as_read: string }
interface IdentifierPacket { extracted_values: IdentifierValue[]; documents: { id: string; pages: { page: number; printed_content: string }[] }[] }
const packet = packetJson as unknown as IdentifierPacket;
export interface EncryptedIdentifier {
  id: string; owner_id: string; actor_id: string; ref: string; ciphertext: string; iv: string; tag: string; created_at: string;
}
function allowed(ref: string): IdentifierValue {
  const value = packet.extracted_values.find(item => item.id === ref);
  if (!value || !(['ssn', 'ein', 'account_number'].includes(value.value_type) || value.field === 'ip_pin')) {
    throw new Error('Choose a supplied SSN, EIN, account number or IP PIN field.');
  }
  return value;
}
export function assertIdentifierAccess(actorId: string, write = false) {
  const actor = getActor(actorId);
  if (!actor.clearance || actor.role === 'client') throw new Error('Sensitive-data clearance is required for this action.');
  if (write && !['preparer', 'reviewer', 'partner', 'quality_reviewer'].includes(actor.role)) {
    throw new Error('Only cleared tax staff can correct an identifier.');
  }
  return actor;
}
export function getSensitiveSource(actorId: string, ref: string) {
  assertIdentifierAccess(actorId);
  const field = allowed(ref);
  const page = packet.documents.find(document => document.id === field.document_id)?.pages.find(item => item.page === field.page);
  if (!page) throw new Error('The source page is unavailable.');
  return { field: { ...field }, printedContent: page.printed_content };
}
function normalizedValue(field: IdentifierValue, value: unknown): string {
  if (typeof value !== 'string' || value.length > 80) throw new Error('Provide an identifier in the expected format.');
  const compact = value.trim().replace(/[ -]/g, '').toUpperCase();
  if (field.value_type === 'ssn') {
    if (!/^\d{9}$/.test(compact)) throw new Error('Use nine digits for an SSN.');
    return `${compact.slice(0, 3)}-${compact.slice(3, 5)}-${compact.slice(5)}`;
  }
  if (field.value_type === 'ein') {
    if (!/^\d{9}$/.test(compact)) throw new Error('Use nine digits for an EIN.');
    return `${compact.slice(0, 2)}-${compact.slice(2)}`;
  }
  if (field.field === 'ip_pin') {
    if (!/^\d{6}$/.test(compact)) throw new Error('Use six digits for an IP PIN.');
    return compact;
  }
  if (!/^(?:\d{4,34}|[A-Z]{2}\d{2}[A-Z0-9]{11,30})$/.test(compact)) {
    throw new Error('Use a numeric account number or an IBAN-format account identifier.');
  }
  return compact;
}
function redactedReason(reason: unknown, value: string): string {
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 20000) throw new Error('Explain the source evidence supporting this correction.');
  // Match the corrected identifier even if its digits/letters are spaced differently
  // in the explanation. No corrected suffix is copied into public metadata either.
  const compact = value.replace(/[^A-Z0-9]/gi, '');
  const pattern = [...compact].map(character => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s-]*');
  return maskSensitiveText(reason.trim().replace(new RegExp(pattern, 'gi'), '[masked identifier]'));
}
function missing(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
async function localKey(directory = process.env.MIRAFLORES_DATA_DIR || path.join(process.cwd(), '.local')): Promise<Buffer> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const keyPath = path.join(directory, 'identifier-key.bin');
  try { await lstat(keyPath); }
  catch (error) {
    if (!missing(error, 'ENOENT')) throw new Error('The local protection key is unavailable.');
    const temporary = path.join(directory, `.identifier-key-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, randomBytes(32), { flag: 'wx', mode: 0o600 });
      // Publish a fully written key without overwriting another process's key.
      try { await link(temporary, keyPath); } catch (linkError) { if (!missing(linkError, 'EEXIST')) throw linkError; }
    } catch { throw new Error('The local protection key could not be initialized.'); }
    finally { try { await unlink(temporary); } catch (cleanupError) { if (!missing(cleanupError, 'ENOENT')) throw new Error('The local protection-key temporary file could not be removed.'); } }
  }
  const metadata = await lstat(keyPath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0) {
    throw new Error('The local protection key must be a private owner-only file.');
  }
  const key = await readFile(keyPath);
  if (key.length !== 32) throw new Error('The local protection key has an invalid length.');
  return key;
}
function additionalData(record: Pick<EncryptedIdentifier, 'id' | 'owner_id' | 'actor_id' | 'ref' | 'created_at'>) {
  return Buffer.from(JSON.stringify({ id: record.id, ownerId: record.owner_id, actorId: record.actor_id, ref: record.ref, createdAt: record.created_at }), 'utf8');
}
export async function encryptCorrection(ownerId: string, actorId: string, ref: string, value: unknown, reason: unknown, directory?: string) {
  assertIdentifierAccess(actorId, true);
  if (typeof ownerId !== 'string' || !ownerId || typeof ref !== 'string') throw new Error('A valid workspace and source reference are required.');
  const field = allowed(ref);
  const normalized = normalizedValue(field, value);
  const metadata = { id: randomUUID(), ref, reason: redactedReason(reason, normalized) };
  const record = { id: metadata.id, owner_id: ownerId, actor_id: actorId, ref, created_at: new Date().toISOString() };
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', await localKey(directory), iv);
  cipher.setAAD(additionalData(record));
  const ciphertext = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const statement = {
    sql: 'INSERT INTO identifier_corrections (id, owner_id, actor_id, ref, ciphertext, iv, tag, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [record.id, ownerId, actorId, ref, ciphertext.toString('base64'), iv.toString('base64'), cipher.getAuthTag().toString('base64'), record.created_at],
  };
  return { metadata, statement };
}
export async function decryptCorrection(record: EncryptedIdentifier, directory?: string): Promise<string> {
  try {
    const decipher = createDecipheriv('aes-256-gcm', await localKey(directory), Buffer.from(record.iv, 'base64'));
    decipher.setAAD(additionalData(record));
    decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  } catch { throw new Error('The protected identifier correction could not be opened.'); }
}
