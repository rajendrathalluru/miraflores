import { cookies, headers } from 'next/headers';
import { getLocalDatabase } from '@/lib/database';
import { actors } from '@/lib/packet';
import type { Actor } from '@/lib/contracts';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function requestContext(write = false): Promise<{ ownerId: string; actor: Actor }> {
  const h = await headers();
  const host = h.get('host') || '';
  const hostname = new URL(`http://${host}`).hostname;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    throw new HttpError(403, 'The development workspace is available on localhost only.');
  }
  if (process.env.NODE_ENV === 'production' && process.env.MIRAFLORES_LOCAL_PREVIEW !== '1') {
    throw new HttpError(503, 'Configure production authentication and database access before deployment. For a loopback-only build preview, use npm run start:local.');
  }
  if (write) {
    const origin = h.get('origin');
    if (origin && host && new URL(origin).host !== host) throw new HttpError(403, 'This action must originate from the workpaper.');
  }
  const selected = (await cookies()).get('mf-persona')?.value || 'st-01';
  const actor = actors.find(a => a.id === selected) || actors[0];
  if (!actor) throw new HttpError(500, 'No workpaper actors are available.');
  return { ownerId: 'local-developer', actor };
}

export function database() { return getLocalDatabase(); }

export function runtimeConfig() {
  return {
    aiEnabled: Boolean(process.env.OPENAI_API_KEY), aiModel: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
    storage: 'SQLite (local)', files: 'Private local files',
    phase: 'Local development', sensitiveData: 'Masked',
    auth: 'Local development only',
  };
}

export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'The action could not be completed.';
  const status = error instanceof HttpError ? error.status : /revision|stale|conflict/i.test(message) ? 409 : 400;
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' } });
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length') || 0) > 100_000) throw new HttpError(413, 'Request is too large.');
  const text = await request.text();
  if (text.length > 100_000) throw new HttpError(413, 'Request is too large.');
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new HttpError(400, 'Provide a valid JSON request.'); }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new HttpError(400, 'Provide a JSON object.');
  return body as Record<string, unknown>;
}
