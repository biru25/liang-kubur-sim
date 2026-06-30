# Simulasi Liang Kubur (Islam) + Deepgram Voice

## Setup

```bash
cd /root/liang-kubur-sim
cp .env.example .env
# Edit .env: DEEPGRAM_API_KEY=your_key
npm install
npm start
```

Buka: `http://<IP-server>:3847`

## Fitur

- Alur: pengantar, jawaban, penguburan, kegelapan, 3 pertanyaan Munkar/Nakir, barzakh, muhasabah
- Suara malaikat: Deepgram TTS (fallback Web Speech API)
- Jawaban suara: rekam mikrofon, Deepgram STT (nova-2, bahasa Indonesia)
- Ketik jawaban jika suara tidak dipakai

## Keamanan

Kunci API hanya di server (`.env`), tidak diekspos ke browser.