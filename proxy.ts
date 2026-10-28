import { NextRequest, NextResponse } from 'next/server';
import { hasWorkspaceAccess } from './lib/access';
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === '/api/health') return NextResponse.next();
  if (hasWorkspaceAccess(req)) return NextResponse.next();
  return new NextResponse('Workspace access requires the configured demo credentials.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Miraflores review", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}
