import { dgFetch, jsonError } from '../lib/deepgram.js';

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json().catch(() => ({}));
    const text = body?.text;
    if (!text || !String(text).trim()) {
      return jsonError('text required', 400);
    }
    const model = body.model || env.DEEPGRAM_TTS_MODEL || 'aura-2-thalia-en';
    const q = new URLSearchParams({ model, encoding: 'mp3' });
    const r = await dgFetch(env, `https://api.deepgram.com/v1/speak?${q}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: String(text) }),
    });
    const audio = await r.arrayBuffer();
    return new Response(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return jsonError(e.message || 'TTS failed', e.status || 500);
  }
}