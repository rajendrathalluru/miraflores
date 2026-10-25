/** Local-only adapter test. Creates an isolated fixture beneath .tmp and removes it. */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { getLocalBucket } from '../../lib/local-storage';

async function main() {
  const scratch = path.join(process.cwd(), '.tmp');
  await mkdir(scratch, { recursive: true });
  const dataDirectory = await mkdtemp(path.join(scratch, 'storage-test-'));
  const originalDirectory = process.env.MIRAFLORES_DATA_DIR;
  process.env.MIRAFLORES_DATA_DIR = dataDirectory;
  try {
    const bucket = getLocalBucket();
    const key = 'attachments/user%2Ffixture%40example.test/123e4567-e89b-12d3-a456-426614174000';
    const read = async () => {
      const object = await bucket.get(key);
      assert.ok(object, 'The saved private object must exist.');
      return new Uint8Array(await new Response(object.body).arrayBuffer());
    };

    assert.equal(await bucket.get(key), null);
    const first = new Uint8Array([0, 1, 2, 127, 128, 255]);
    await bucket.put(key, first.buffer, { httpMetadata: { contentType: 'application/pdf' } });
    assert.deepEqual(await read(), first);
    // A newly constructed adapter reads the same durable files, without an in-memory cache.
    assert.ok(await getLocalBucket().get(key));

    const replacement = new TextEncoder().encode('Complete replacement, not an appended file.');
    await bucket.put(key, replacement.buffer);
    assert.deepEqual(await read(), replacement);

    const concurrentA = new Uint8Array(500_000).fill(17);
    const concurrentB = new Uint8Array(500_000).fill(33);
    await Promise.all([bucket.put(key, concurrentA.buffer), bucket.put(key, concurrentB.buffer)]);
    const current = await read();
    assert.ok(Buffer.from(current).equals(Buffer.from(concurrentA)) || Buffer.from(current).equals(Buffer.from(concurrentB)), 'Concurrent replacement must leave one complete object.');

    const files = await readdir(path.join(dataDirectory, 'files'));
    assert.equal(files.length, 1, 'Successful puts must not leave temporary files.');
    assert.match(files[0], /^[a-f0-9]{64}$/);
    if (process.platform !== 'win32') {
      assert.equal((await stat(path.join(dataDirectory, 'files', files[0]))).mode & 0o077, 0, 'Private objects must be readable only by their filesystem owner.');
    }

    await bucket.delete(key);
    assert.equal(await bucket.get(key), null);
    await bucket.delete(key); // Removing an already-absent object is idempotent.
    await bucket.put(key, new ArrayBuffer(0));
    assert.equal((await read()).byteLength, 0);
    await bucket.delete(key);

    for (const invalid of ['', '../secret', 'a/../secret', '/absolute', 'a\\b', 'a\0b', 'a//b', '.', 'a/./b', 'a/', 'C:/tmp/file', 'line\nbreak', 'x'.repeat(1025)]) {
      await assert.rejects(bucket.put(invalid, new ArrayBuffer(0)), /Invalid private file key/);
      await assert.rejects(bucket.get(invalid), /Invalid private file key/);
      await assert.rejects(bucket.delete(invalid), /Invalid private file key/);
    }
    await assert.rejects(bucket.put(key, new ArrayBuffer(8_000_001)), /8 MB/);
    assert.deepEqual(await readdir(path.join(dataDirectory, 'files')), []);
    console.log('PASS local private storage: durable binary read/write, atomic replacement, concurrent puts, encoded keys, empty files, delete, permissions, traversal rejection and size limit.');
  } finally {
    if (originalDirectory === undefined) delete process.env.MIRAFLORES_DATA_DIR;
    else process.env.MIRAFLORES_DATA_DIR = originalDirectory;
    await rm(dataDirectory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Storage tests failed.');
  process.exitCode = 1;
});
