// CORS helper: only allow requests from the site's own origin(s), since this
// Worker exists purely to back /shop/'s checkout for machinemens.com and its
// staging/preview domains -- never a public API.
//
// env.ALLOWED_ORIGINS is a comma-separated list. An entry starting with "*."
// matches any subdomain (used for Cloudflare Pages PR-preview URLs, which get
// a random pr-<n> hash prefix on *.machinemens-com-staging.pages.dev).
function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return false;
  return allowedOrigins.some((allowed) => {
    if (allowed.startsWith('*.')) {
      return origin.endsWith(allowed.slice(1));
    }
    return origin === allowed;
  });
}

export function corsHeaders(request, env) {
  const allowedOrigins = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  };
  if (isAllowedOrigin(origin, allowedOrigins)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function jsonResponse(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request, env)
    }
  });
}
