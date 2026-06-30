require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT || 3847);
const DG_KEY = process.env.DEEPGRAM_API_KEY || process.env.DG_API_KEY || '';
const TTS_VOICE = process.env.TTS_VOICE || 'id-ID-GadisNeural';
const EDGE_TTS = process.env.EDGE_TTS_BIN || 'edge-tts';

const app = express();
app.use(express.json({ limit: '2mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

app.use(express.static(path.join(__dirname, 'public')));

const AUDIO_DIR = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

function findBacksound() {
  const names = ['backsound.mp3', 'backsound.ogg', 'backsound.wav', 'backsound.m4a', 'backsound.webm'];
  for (const name of names) {
    const p = path.join(AUDIO_DIR, name);
    if (fs.existsSync(p)) return { ok: true, url: `/audio/${name}`, file: name };
  }
  return { ok: false };
}

app.get('/api/backsound-status', (_req, res) => {
  res.json(findBacksound());
});

app.post('/api/backsound', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    const ext = path.extname(req.file.originalname || '').toLowerCase() || '.mp3';
    const allowed = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.webm']);
    const useExt = allowed.has(ext) ? ext : '.mp3';
    for (const name of ['backsound.mp3', 'backsound.ogg', 'backsound.wav', 'backsound.m4a', 'backsound.webm']) {
      const p = path.join(AUDIO_DIR, name);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    const dest = path.join(AUDIO_DIR, `backsound${useExt}`);
    fs.writeFileSync(dest, req.file.buffer);
    res.json({ ok: true, ...findBacksound() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    deepgram: Boolean(DG_KEY),
    tts: 'edge',
    ttsVoice: TTS_VOICE,
    port: PORT,
  });
});

async function deepgramFetch(url, init = {}) {
  if (!DG_KEY) {
    const err = new Error('DEEPGRAM_API_KEY belum diset di .env');
    err.status = 503;
    throw err;
  }
  const headers = {
    Authorization: `Token ${DG_KEY}`,
    ...(init.headers || {}),
  };
  const r = await fetch(url, { ...init, headers });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    const err = new Error(`Deepgram ${r.status}: ${body.slice(0, 400)}`);
    err.status = r.status;
    throw err;
  }
  return r;
}

async function edgeSpeak(text, voice = TTS_VOICE) {
  const tmp = path.join(__dirname, `.tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  try {
    await execFileAsync(
      EDGE_TTS,
      ['--voice', voice, '--text', String(text), '--write-media', tmp],
      { timeout: 60000, maxBuffer: 4 * 1024 * 1024 }
    );
    const buf = fs.readFileSync(tmp);
    return buf;
  } finally {
    fs.unlink(tmp, () => {});
  }
}

app.post('/api/tts', async (req, res) => {
  try {
    const { text, provider = 'edge', model = 'aura-2-thalia-en', voice } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'text required' });
    }
    let buf;
    if (provider === 'deepgram') {
      const q = new URLSearchParams({ model, encoding: 'mp3' });
      const r = await deepgramFetch(`https://api.deepgram.com/v1/speak?${q}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: String(text) }),
      });
      buf = Buffer.from(await r.arrayBuffer());
    } else {
      buf = await edgeSpeak(String(text), voice || TTS_VOICE);
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post('/api/stt', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'audio file required' });
    const lang = (req.body && req.body.language) || 'id';
    const q = new URLSearchParams({
      model: 'nova-2',
      language: lang,
      punctuate: 'true',
      smart_format: 'true',
    });
    const r = await deepgramFetch(`https://api.deepgram.com/v1/listen?${q}`, {
      method: 'POST',
      headers: {
        'Content-Type': req.file.mimetype || 'audio/webm',
      },
      body: req.file.buffer,
    });
    const data = await r.json();
    const transcript =
      data?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || '';
    res.json({ transcript, raw: data });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`liang-kubur-sim http://0.0.0.0:${PORT} deepgram=${DG_KEY ? 'on' : 'off'}`);
});