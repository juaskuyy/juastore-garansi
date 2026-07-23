# JuaStore Garansi V2

Fitur: database D1, dashboard admin, pencarian, status, catatan admin, cek status customer, export CSV, Telegram, screenshot, dan tombol WhatsApp.

## 1. Upload semua file ke repository GitHub

Timpa file versi lama dengan file paket ini.

## 2. Buat D1 Database

Cloudflare → Workers & Pages → D1 SQL Database → Create.

Nama:

`juastore-garansi-db`

Salin Database ID.

## 3. Edit wrangler.toml

Ganti:

`GANTI_DENGAN_DATABASE_ID_D1`

dengan Database ID D1, lalu commit.

## 4. Jalankan database

Buka D1 → Console → salin seluruh isi `schema.sql` → Execute.

## 5. Pasang binding

Worker → Settings → Bindings → Add → D1 database:

- Variable name: `DB`
- Database: `juastore-garansi-db`

## 6. Variables and Secrets

- `TELEGRAM_BOT_TOKEN` = token baru BotFather
- `TELEGRAM_CHAT_ID` = ID admin/grup
- `ALLOWED_ORIGIN` = `https://juastore.biz.id`
- `ADMIN_KEY` = password rahasia dashboard

Deploy ulang.

## 7. Alamat

- Form: `https://juastore.biz.id`
- Cek status: `https://juastore.biz.id/cek.html`
- Dashboard: `https://juastore.biz.id/admin.html`

Login dashboard menggunakan nilai `ADMIN_KEY`.

PENTING: revoke token Telegram lama karena pernah terlihat di screenshot.
