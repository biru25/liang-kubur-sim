export async function onRequestGet(context) {
  const { env } = context;
  const key = env.DEEPGRAM_API_KEY || env.DG_API_KEY || '';
  return Response.json({
    ok: true,
    deepgram: Boolean(key),
    tts: 'deepgram',
    ttsVoice: env.DEEPGRAM_TTS_MODEL || 'aura-2-thalia-en',
    platform: 'cloudflare-pages',
  });
}