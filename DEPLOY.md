# Deploy — GitHub + Cloudflare Pages

## ⚠️ Build gagal: `npx wrangler deploy`

Kalau log Cloudflare berisi **Deploy command: `npx wrangler deploy`** → itu **salah** (itu perintah **Workers**, bukan Pages).

**Perbaikan di dashboard** (Workers & Pages → proyek → Settings → Builds):

| Field | Nilai yang benar |
|--------|------------------|
| **Build command** | *(kosong)* atau `npm run pages:build` |
| **Build output directory** | `public` |
| **Root directory** | `/` |
| **Deploy command** *(wajib di UI baru)* | **`npm run pages:deploy`** |

Isi persis deploy command (satu baris):

```text
npm run pages:deploy
```

Atau tanpa npm script:

```text
npx wrangler pages deploy . --project-name=liang-kubur-sim --commit-dirty=true
```

**Jangan** pakai `npx wrangler deploy` (itu Workers, bukan Pages).

Simpan → **Retry deployment**. Pages otomatis pakai folder `functions/` + static `public/` (lihat `wrangler.toml` → `pages_build_output_dir`).

---

## GitHub

Repo: https://github.com/biru25/liang-kubur-sim

`.env` dan `node_modules` tidak ikut commit.

## Cloudflare Pages

**Stack di edge:** static `public/` + Functions di `functions/api/*`.

| Route | VPS (Express) | Cloudflare |
|-------|---------------|------------|
| TTS | Edge `id-ID-GadisNeural` | Deepgram Speak (`DEEPGRAM_TTS_MODEL`) |
| STT | Deepgram nova-2 | Deepgram nova-2 |
| Backsound | file `public/audio/backsound.mp3` | sama (static) |

### 1. Secret wajib

Dashboard → proyek → Settings → Environment variables → **Production**:

- `DEEPGRAM_API_KEY` (encrypted)

Opsional: `DEEPGRAM_TTS_MODEL` (default di `wrangler.toml`: `aura-2-thalia-en`)

### 2. Connect GitHub (disarankan)

Pages → **Connect to Git** → `biru25/liang-kubur-sim`, branch `main`:

- Build command: kosong (atau `npm run pages:build`)
- Output directory: **`public`**
- **Jangan** isi Deploy command dengan `wrangler deploy`

Setiap push `main` → auto-deploy.

### 3. Deploy CLI (alternatif)

```bash
npm install
export CLOUDFLARE_API_TOKEN=...   # token dengan Pages Edit
npx wrangler pages secret put DEEPGRAM_API_KEY --project-name=liang-kubur-sim
npm run deploy:cf
```

`deploy:cf` = **`wrangler pages deploy`** (bukan `wrangler deploy`).

### 4. Link untuk teman

Setelah deploy sukses, bagikan:

`https://liang-kubur-sim.pages.dev` (atau custom domain di Pages)

Bukan link GitHub — teman buka URL web itu di browser.

### 5. Verifikasi

```bash
curl -s https://<your-pages>.pages.dev/api/health
curl -s https://<your-pages>.pages.dev/api/backsound-status
```

Buka situs → Mulai simulasi → backsound + suara + STT.

## VPS (tetap)

```bash
cp .env.example .env
npm start   # port 3847, TTS Edge Gadis
```