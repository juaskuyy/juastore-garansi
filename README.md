# JuaStore Garansi Final

Paket ini sudah dipisahkan agar tidak tertukar:

- `worker.js` → Cloudflare Worker
- `wrangler.toml` → konfigurasi Cloudflare
- `docs/index.html` → website garansi untuk GitHub Pages

## 1. Upload ke GitHub

Buat repository baru, lalu upload SEMUA isi ZIP ini.

Struktur setelah upload:

```text
JuaStore_Garansi_Final/
├── worker.js
├── wrangler.toml
├── README.md
├── .gitignore
└── docs/
    └── index.html
```

## 2. Hubungkan repository ke Cloudflare Workers

Di Cloudflare:

1. Workers & Pages
2. Create
3. Import a repository
4. Pilih repository ini
5. Deploy

Cloudflare akan membaca `wrangler.toml` dan menjalankan `worker.js`.

## 3. Tambahkan Variables and Secrets

Pada Worker:

Settings → Variables and Secrets

Tambahkan:

```text
TELEGRAM_BOT_TOKEN = token baru dari BotFather
TELEGRAM_CHAT_ID = ID Telegram admin
ALLOWED_ORIGIN = *
```

Penting:

- Tekan `/start` pada bot sebelum tes.
- Token yang pernah terlihat wajib di-revoke melalui BotFather.
- Jangan menaruh token di `docs/index.html`.

## 4. Tes Worker

Buka URL Worker:

```text
https://nama-worker.username.workers.dev
```

Hasil yang benar:

```json
{"success":true,"message":"JuaStore Garansi API aktif."}
```

## 5. Hubungkan website ke Worker

Buka file:

```text
docs/index.html
```

Cari:

```javascript
const API_ENDPOINT =
  "GANTI_DENGAN_URL_WORKER";
```

Ganti menjadi URL Worker:

```javascript
const API_ENDPOINT =
  "https://nama-worker.username.workers.dev";
```

Commit perubahan.

## 6. Aktifkan GitHub Pages

Di repository GitHub:

1. Settings
2. Pages
3. Source: Deploy from a branch
4. Branch: `main`
5. Folder: `/docs`
6. Save

Website akan tersedia di alamat GitHub Pages.

## 7. Tes

Isi form, upload screenshot, lalu klik Kirim.

Hasil:

- Data masuk ke Telegram admin.
- Screenshot ikut terkirim.
- Telegram menampilkan tombol `Balas WhatsApp`.
- Customer tetap berada di website.