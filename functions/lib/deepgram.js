/** Shared Deepgram helpers for Cloudflare Pages Functions */

export function dgKey(env) {
  return env.DEEPGRAM_API_KEY || env.DG_API_KEY || '';
}

export async function dgFetch(env, url, init = {}) {
  const key = dgKey(env);
  if (!key) {
    const err = new Error('DEEPGRAM_API_KEY belum diset (Cloudflare secret)');
    err.status = 503;
    throw err;
  }
  const headers = {
    Authorization: `Token ${key}`,
    ...(init.headers || {}),
  };
  const r = await fetch(url, { ...init, headers });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    const err = new Error('Deepgram ' + r.status + ': ' + body.slice(0, 400));
    err.status = r.status;
    throw err;
  }
  return r;
}

export function jsonError(message, status = 500) {
  return Response.json({ error: message }, { status });
}
