import { dgFetch, jsonError } from '../lib/deepgram.js';

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const form = await request.formData();
    const audio = form.get('audio');
    if (!audio || typeof audio === 'string') {
      return jsonError('audio file required', 400);
    }
    const language = String(form.get('language') || 'id');
    const mime = audio.type || 'audio/webm';
    const buf = await audio.arrayBuffer();
    const q = new URLSearchParams({
      model: 'nova-2',
      language,
      punctuate: 'true',
      smart_format: 'true',
    });
    const r = await dgFetch(env, `https://api.deepgram.com/v1/listen?${q}`, {
      method: 'POST',
      headers: { 'Content-Type': mime },
      body: buf,
    });
    const data = await r.json();
    const transcript =
      data?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || '';
    return Response.json({ transcript, raw: data });
  } catch (e) {
    return jsonError(e.message || 'STT failed', e.status || 500);
  }
}