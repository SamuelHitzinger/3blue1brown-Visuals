/** An optional exact website origin lets a private reverse proxy coexist with localhost. */
export function isTrustedAppRequest(request: Request, primaryOrigin = process.env.NARRATION_PUBLIC_ORIGIN, websiteOrigin = process.env.APP_PUBLIC_ORIGIN): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const url = new URL(request.url);
  const expected = primaryOrigin ?? `${request.headers.get('x-forwarded-proto') ?? url.protocol.slice(0, -1)}://${url.host}`;
  return origin === expected || (!!websiteOrigin && origin === websiteOrigin);
}
