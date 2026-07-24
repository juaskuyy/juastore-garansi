# JuaStore Garansi V3

## Isi file
- `worker.js` — Cloudflare Worker API
- `schema.sql` — struktur database D1
- `index.html` — form pengajuan
- `cek.html` — cek status
- `admin.html` — dashboard admin
- `style.css` — tampilan
- `wrangler.toml` — konfigurasi Worker

## A. Buat Worker dari awal

1. Masuk Cloudflare Dashboard.
2. Buka **Workers & Pages**.
3. Buat Worker baru bernama `garansi`.
4. Hubungkan Worker ke repository GitHub.
5. Pastikan file utama adalah `worker.js`.
6. Deploy.

## B. Buat database D1

1. Cloudflare → **Storage & Databases** → **D1 SQL Database**.
2. Buat database bernama `juastore-garansi-db`.
3. Buka tab Console.
4. Salin seluruh isi `schema.sql`, lalu jalankan.
5. Buka Worker → Settings → Bindings.
6. Tambahkan D1 Database:
   - Variable name: `DB`
   - Database: `juastore-garansi-db`

## C. Tambahkan Variables and Secrets

Pada Worker → Settings → Variables and Secrets:

- `ADMIN_KEY` = password dashboard admin
- `TELEGRAM_BOT_TOKEN` = token bot Telegram
- `TELEGRAM_CHAT_ID` = chat ID penerima
- `ALLOWED_ORIGIN` = `*` untuk tes awal

Setelah berhasil, ubah `ALLOWED_ORIGIN` menjadi:
`https://juastore.biz.id`

Tanpa garis miring `/` di belakang.

## D. Pasang website

Upload ke GitHub Pages:
- `index.html`
- `cek.html`
- `admin.html`
- `style.css`

Ketiga file sudah memakai:
`https://garansi.jhonyoga01.workers.dev`

Jika nama Worker berbeda, cari URL tersebut dan ganti di ketiga file.

## E. Tes

1. Buka:
   `https://garansi.jhonyoga01.workers.dev`

   Harus tampil JSON API aktif.

2. Kirim form dari `index.html`.

3. Buka `admin.html`, lalu login menggunakan nilai `ADMIN_KEY`.

## Catatan keamanan

Jangan menaruh `ADMIN_KEY` atau token Telegram di file HTML.
Semua rahasia hanya disimpan di Cloudflare Variables and Secrets.
