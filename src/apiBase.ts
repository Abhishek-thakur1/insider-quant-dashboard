// Resolve the API base URL for the browser.
// An HTTPS page cannot call a plain-http API (browsers block it as mixed content),
// so in that case the configured URL is ignored and the relative /api route
// (the Vercel rewrite) is used instead. An https:// URL is kept as configured.
export function resolveApiBase(configured: string | undefined, pageProtocol: string | undefined): string {
  const url = (configured ?? '').trim().replace(/\/+$/, '');
  if (!url) return '';
  if (pageProtocol === 'https:' && /^http:\/\//i.test(url)) return '';
  return url;
}
