import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { hasWorkspaceAccess } from '../lib/access';
test('hosted demo requires valid server-side credentials', () => {
  const oldPassword = process.env.WORKPAPER_ACCESS_PASSWORD;
  const oldUser = process.env.WORKPAPER_ACCESS_USER;
  const oldToken = process.env.WORKPAPER_ACCESS_TOKEN;
  try {
    delete process.env.WORKPAPER_ACCESS_TOKEN;
    delete process.env.WORKPAPER_ACCESS_PASSWORD;
    assert.equal(hasWorkspaceAccess(new NextRequest('https://demo.example.com')), false);
    assert.equal(hasWorkspaceAccess(new NextRequest('http://127.0.0.1:3000')), true);
    process.env.WORKPAPER_ACCESS_PASSWORD = 'test-only-password';
    process.env.WORKPAPER_ACCESS_USER = 'reviewer';
    assert.equal(hasWorkspaceAccess(new NextRequest('http://127.0.0.1:3000')), false);
    for (const [credential, expected] of [
      ['reviewer:wrong', false],
      ['reviewer:test-only-password', true],
    ] as const) {
      const req = new NextRequest('https://demo.example.com', {
        headers: { authorization: `Basic ${Buffer.from(credential).toString('base64')}` },
      });
      assert.equal(hasWorkspaceAccess(req), expected);
    }
  } finally {
    for (const [key, value] of Object.entries({
      WORKPAPER_ACCESS_PASSWORD: oldPassword,
      WORKPAPER_ACCESS_USER: oldUser,
      WORKPAPER_ACCESS_TOKEN: oldToken,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
