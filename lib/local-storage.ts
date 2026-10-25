import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_OBJECT_BYTES = 8_000_000;

export interface LocalBucketObject {
  body: ReadableStream<Uint8Array>;
}

export interface LocalBucket {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<void>;
  get(key: string): Promise<LocalBucketObject | null>;
  delete(key: string): Promise<void>;
}

function validatedKey(key: string): string {
  if (typeof key !== 'string' || !key || Buffer.byteLength(key, 'utf8') > 1024 ||
    /[\x00-\x1f\x7f\\]/.test(key) || path.isAbsolute(key) || /^[a-z]:/i.test(key) ||
    key.split('/').some((component) => !component || component === '.' || component === '..')) {
    throw new Error('Invalid private file key.');
  }
  return key;
}

function missing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

/** Local private-object adapter. The server owns authentication and owner-scoped keys.
 * Keys remain opaque: percent-encoded owner IDs are never decoded into filesystem paths.
 * Hashing validated keys also avoids filename collisions, platform separators and key leaks.
 */
export function getLocalBucket(): LocalBucket {
  const filesDirectory = path.resolve(process.env.MIRAFLORES_DATA_DIR || path.join(process.cwd(), '.local'), 'files');
  const filename = (key: string) => path.join(filesDirectory, createHash('sha256').update(validatedKey(key)).digest('hex'));

  return {
    async put(key, value, _options) {
      void _options; // Downloads intentionally use application/octet-stream.
      const destination = filename(key);
      if (!(value instanceof ArrayBuffer) || value.byteLength > MAX_OBJECT_BYTES) {
        throw new Error('Private files must be ArrayBuffers no larger than 8 MB.');
      }
      // Snapshot the input before awaiting I/O, so caller mutation cannot alter a write.
      const bytes = Buffer.from(new Uint8Array(value));
      await mkdir(filesDirectory, { recursive: true, mode: 0o700 });
      const temporary = `${destination}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
        await rename(temporary, destination);
      } finally {
        try { await unlink(temporary); } catch (error) { if (!missing(error)) throw error; }
      }
      // Download endpoints deliberately force application/octet-stream. The R2-compatible
      // contentType option is accepted but not persisted or used as a response header.
    },

    async get(key) {
      const source = filename(key);
      let bytes: Buffer;
      try {
        if ((await stat(source)).size > MAX_OBJECT_BYTES) throw new Error('Private file exceeds the 8 MB limit.');
        bytes = await readFile(source);
      } catch (error) {
        if (missing(error)) return null;
        throw error;
      }
      if (bytes.byteLength > MAX_OBJECT_BYTES) throw new Error('Private file exceeds the 8 MB limit.');
      return {
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(bytes));
            controller.close();
          },
        }),
      };
    },

    async delete(key) {
      try { await unlink(filename(key)); } catch (error) { if (!missing(error)) throw error; }
    },
  };
}
