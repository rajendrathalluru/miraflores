import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function hasWorkspaceAccess(req: NextRequest) {
  const header = req.headers.get('authorization') || '';
  const password = process.env.WORKPAPER_ACCESS_PASSWORD;
  const token = process.env.WORKPAPER_ACCESS_TOKEN;
  if (token && equal(header, `Bearer ${token}`)) return true;
  if (password) {
    const expected = Buffer.from(
      `${process.env.WORKPAPER_ACCESS_USER || 'reviewer'}:${password}`,
    ).toString('base64');
    return equal(header, `Basic ${expected}`);
  }
  const host = (req.headers.get('host') || req.nextUrl.host).replace(/:\d+$/, '');
  return ['localhost', '127.0.0.1', '[::1]'].includes(host);
}
