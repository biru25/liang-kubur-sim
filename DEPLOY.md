# Deploy — GitHub + Cloudflare Pages

## GitHub

```bash
cd /root/liang-kubur-sim
git init
git add .
git commit -m "feat: simulasi liang kubur + CF Pages Functions"
git branch -M main
git remote add origin https://github.com/biru25/liang-kubur-sim.git
git push -u origin main
```

`.env` dan `node_modules` tidak ikut commit (lihat `.gitignore`).

## Cloudflare Pages

**Stack di edge:** static `public/` + Functions di `functions/api/*`.

| Route | VPS (Express) | Cloudflare |
|-------|---------------|------------|
| TTS | Edge `id-ID-GadisNeural` | Deepgram Speak (`DEEPGRAM_TTS_MODEL`) |
| STT | Deepgram nova-2 | Deepgram nova-2 |
| Backsound | file `public/audio/backsound.mp3` | sama (static) |

### 1. Secret wajib

Di Cloudflare dashboard → Workers & Pages → proyek → Settings → Environment variables:

- `DEEPGRAM_API_KEY` — **Production** (encrypted)

Opsional:

- `DEEPGRAM_TTS_MODEL` — default di `wrangler.toml`: `aura-2-thalia-en` (ganti jika punya model Indo yang didukung Deepgram)

### 2. Deploy CLI

```bash
npm install
npx wrangler pages project create liang-kubur-sim --production-branch main
export CLOUDFLARE_API_TOKEN=...   # dari dash.cloudflare.com/profile/api-tokens
npx wrangler pages secret put DEEPGRAM_API_KEY
npm run deploy:cf
```

`npm run deploy:cf` menjalankan `wrangler pages deploy .` (static dari `public/` + Functions).

### 3. Connect GitHub (opsional)

Pages → Create project → Connect to Git → repo `biru25/liang-kubur-sim`:

- Build command: *(kosong)*
- Build output directory: `public`
- Root directory: `/`
- Tambah secret `DEEPGRAM_API_KEY` di dashboard

Setiap push ke `main` auto-deploy.

### 4. Verifikasi

```bash
curl -s https://<your-pages>.pages.dev/api/health
curl -s https://<your-pages>.pages.dev/api/backsound-status
```

Buka situs → Mulai simulasi → backsound + suara malaikat + STT.

## VPS (tetap)

```bash
cp .env.example .env   # isi DEEPGRAM_API_KEY
npm start              # port 3847, TTS Edge Gadis
```