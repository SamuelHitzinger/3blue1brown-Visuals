import { expect, test } from 'bun:test';
import { isTrustedAppRequest } from '../src/request-origin.js';

test('explicit tailnet website origin and desktop origin both work without allowing other sites', () => {
  const check = (origin: string, site = 'same-origin') => isTrustedAppRequest(new Request('http://127.0.0.1:8080/api/lectures', { headers: { origin, 'sec-fetch-site': site } }), 'http://127.0.0.1:8080', 'https://computer.tail123.ts.net');
  expect(check('http://127.0.0.1:8080')).toBe(true);
  expect(check('https://computer.tail123.ts.net')).toBe(true);
  expect(check('https://other.tail123.ts.net')).toBe(false);
  expect(check('https://computer.tail123.ts.net.evil.example')).toBe(false);
  expect(check('null')).toBe(false);
  expect(check('https://computer.tail123.ts.net', 'cross-site')).toBe(false);
});

test('existing same-origin proxy behavior remains when no extra website origin is configured', () => {
  const request = new Request('http://computer.tail123.ts.net/api/lectures', { headers: { origin: 'https://computer.tail123.ts.net', 'x-forwarded-proto': 'https' } });
  expect(isTrustedAppRequest(request, undefined, undefined)).toBe(true);
  expect(isTrustedAppRequest(request, 'https://configured.example', undefined)).toBe(false);
  expect(isTrustedAppRequest(new Request('http://localhost/api/lectures'), undefined, undefined)).toBe(true);
});
