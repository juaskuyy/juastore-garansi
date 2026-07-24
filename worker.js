const JSON_HEADERS = {
  "Content-Type": "application/json; charset=UTF-8",
};

export default {
  async fetch(request, env) {
    const cors = getCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    try {
      if (request.method === "GET" && path === "/") {
        return json(
          { success: true, message: "JuaStore Garansi API aktif." },
          200,
          cors
        );
      }

      if (request.method === "POST" && path === "/api/claims") {
        return await createClaim(request, env, cors);
      }

      if (request.method === "GET" && path.startsWith("/api/status/")) {
        const id = decodeURIComponent(path.slice("/api/status/".length));
        return await getStatus(id, env, cors);
      }

      if (path.startsWith("/api/admin")) {
        requireAdmin(request, env);

        if (request.method === "GET" && path === "/api/admin/claims") {
          return await listClaims(url, env, cors);
        }

        if (request.method === "GET" && path === "/api/admin/stats") {
          return await getStats(env, cors);
        }

        if (request.method === "PATCH" && path.startsWith("/api/admin/claims/")) {
          const id = decodeURIComponent(path.slice("/api/admin/claims/".length));
          return await updateClaim(id, request, env, cors);
        }

        if (request.method === "DELETE" && path.startsWith("/api/admin/claims/")) {
          const id = decodeURIComponent(path.slice("/api/admin/claims/".length));
          return await deleteClaim(id, env, cors);
        }
      }

      return json(
        { success: false, message: "Endpoint tidak ditemukan.", method: request.method, path },
        404,
        cors
      );
    } catch (error) {
      console.error(error);
      return json(
        { success: false, message: error?.message || "Kesalahan server." },
        Number(error?.status) || 500,
        cors
      );
    }
  },
};

async function createClaim(request, env, cors) {
  requireDB(env);
  requireTelegram(env);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Data harus berupa JSON." }, 400, cors);
  }

  const name = clean(body.name);
  const whatsapp = normalizeWhatsapp(body.whatsapp);
  const product = clean(body.product);
  const account = clean(body.account);
  const orderId = clean(body.orderId);
  const orderDate = clean(body.orderDate);
  const duration = clean(body.duration);
  const claimType = clean(body.claimType || "Garansi");
  const problem = clean(body.problem);
  const evidenceDataUrl = clean(body.evidenceDataUrl);

  if (!name || !whatsapp || !product || !problem) {
    return json(
      { success: false, message: "Nama, WhatsApp, produk, dan kendala wajib diisi." },
      400,
      cors
    );
  }

  if (whatsapp.length < 9 || whatsapp.length > 16) {
    return json({ success: false, message: "Nomor WhatsApp tidak valid." }, 400, cors);
  }

  if (evidenceDataUrl && evidenceDataUrl.length > 8_000_000) {
    return json(
      { success: false, message: "Screenshot terlalu besar. Maksimal sekitar 5 MB." },
      413,
      cors
    );
  }

  const id = generateId();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO claims (
      id, name, whatsapp, product, account, order_id, order_date,
      duration, claim_type, problem, status, admin_note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, name, whatsapp, product, account, orderId, orderDate,
    duration, claimType, problem, "Menunggu", "", now, now
  ).run();

  let telegramWarning = "";

  try {
    await sendTelegramMessage(env, {
      chat_id: env.TELEGRAM_CHAT_ID,
      text: buildTelegramText({
        id, name, whatsapp, product, account, orderId,
        orderDate, duration, claimType, problem
      }),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[{
          text: "💬 Balas WhatsApp",
          url: `https://wa.me/${whatsapp}?text=${encodeURIComponent(
            `Halo ${name}, pengajuan JuaStore dengan ID ${id} sudah kami terima.`
          )}`
        }]]
      }
    });

    if (evidenceDataUrl) {
      await sendTelegramPhoto(env, evidenceDataUrl, `Bukti screenshot\nID: ${id}`);
    }
  } catch (error) {
    console.error("Telegram:", error);
    telegramWarning = error?.message || "Notifikasi Telegram gagal.";
  }

  return json({
    success: true,
    warrantyId: id,
    message: telegramWarning
      ? "Pengajuan tersimpan, tetapi notifikasi Telegram gagal."
      : "Pengajuan berhasil dikirim.",
    warning: telegramWarning || undefined
  }, 200, cors);
}

async function getStatus(rawId, env, cors) {
  requireDB(env);
  const id = clean(rawId).toUpperCase();

  const row = await env.DB.prepare(`
    SELECT id, product, claim_type, status, admin_note, created_at, updated_at
    FROM claims WHERE id = ?
  `).bind(id).first();

  if (!row) {
    return json({ success: false, message: "ID garansi tidak ditemukan." }, 404, cors);
  }

  return json({ success: true, data: row }, 200, cors);
}

async function listClaims(url, env, cors) {
  requireDB(env);

  const q = clean(url.searchParams.get("q"));
  const status = clean(url.searchParams.get("status"));

  let sql = "SELECT * FROM claims WHERE 1=1";
  const binds = [];

  if (q) {
    sql += ` AND (
      id LIKE ? OR name LIKE ? OR whatsapp LIKE ?
      OR product LIKE ? OR account LIKE ? OR order_id LIKE ?
    )`;
    const keyword = `%${q}%`;
    binds.push(keyword, keyword, keyword, keyword, keyword, keyword);
  }

  if (status) {
    sql += " AND status = ?";
    binds.push(status);
  }

  sql += " ORDER BY created_at DESC LIMIT 500";

  const result = await env.DB.prepare(sql).bind(...binds).all();
  return json({ success: true, data: result.results || [] }, 200, cors);
}

async function getStats(env, cors) {
  requireDB(env);

  const row = await env.DB.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='Menunggu' THEN 1 ELSE 0 END) AS menunggu,
      SUM(CASE WHEN status='Diproses' THEN 1 ELSE 0 END) AS diproses,
      SUM(CASE WHEN status='Selesai' THEN 1 ELSE 0 END) AS selesai,
      SUM(CASE WHEN status='Ditolak' THEN 1 ELSE 0 END) AS ditolak,
      SUM(CASE WHEN date(created_at)=date('now') THEN 1 ELSE 0 END) AS hari_ini
    FROM claims
  `).first();

  return json({
    success: true,
    data: {
      total: Number(row?.total || 0),
      menunggu: Number(row?.menunggu || 0),
      diproses: Number(row?.diproses || 0),
      selesai: Number(row?.selesai || 0),
      ditolak: Number(row?.ditolak || 0),
      hari_ini: Number(row?.hari_ini || 0)
    }
  }, 200, cors);
}

async function updateClaim(rawId, request, env, cors) {
  requireDB(env);

  const id = clean(rawId).toUpperCase();
  const body = await request.json();
  const status = clean(body.status);
  const adminNote = clean(body.adminNote);

  const allowed = ["Menunggu", "Diproses", "Selesai", "Ditolak"];
  if (!allowed.includes(status)) {
    return json({ success: false, message: "Status tidak valid." }, 400, cors);
  }

  const existing = await env.DB.prepare("SELECT id FROM claims WHERE id=?")
    .bind(id).first();

  if (!existing) {
    return json({ success: false, message: "ID garansi tidak ditemukan." }, 404, cors);
  }

  await env.DB.prepare(`
    UPDATE claims SET status=?, admin_note=?, updated_at=? WHERE id=?
  `).bind(status, adminNote, new Date().toISOString(), id).run();

  return json({ success: true, message: "Status berhasil diperbarui." }, 200, cors);
}

async function deleteClaim(rawId, env, cors) {
  requireDB(env);
  const id = clean(rawId).toUpperCase();

  const existing = await env.DB.prepare("SELECT id FROM claims WHERE id=?")
    .bind(id).first();

  if (!existing) {
    return json({ success: false, message: "ID garansi tidak ditemukan." }, 404, cors);
  }

  await env.DB.prepare("DELETE FROM claims WHERE id=?").bind(id).run();
  return json({ success: true, message: "Data berhasil dihapus." }, 200, cors);
}

function requireAdmin(request, env) {
  if (!env.ADMIN_KEY) {
    throw Object.assign(new Error("ADMIN_KEY belum dipasang."), { status: 500 });
  }

  const value = request.headers.get("Authorization") || "";
  if (value !== `Bearer ${env.ADMIN_KEY}`) {
    throw Object.assign(new Error("Akses admin ditolak."), { status: 401 });
  }
}

function requireDB(env) {
  if (!env.DB) throw new Error("Binding D1 dengan nama DB belum dipasang.");
}

function requireTelegram(env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    throw new Error("TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum dipasang.");
  }
}

async function sendTelegramMessage(env, payload) {
  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    }
  );

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || "Telegram gagal mengirim pesan.");
  }
}

async function sendTelegramPhoto(env, dataUrl, caption) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);

  if (!match) {
    throw new Error("Format screenshot tidak valid.");
  }

  const mime = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";

  const form = new FormData();
  form.append("chat_id", env.TELEGRAM_CHAT_ID);
  form.append("caption", caption);
  form.append("photo", new Blob([bytes], { type: mime }), `bukti.${ext}`);

  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
    { method: "POST", body: form }
  );

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || "Telegram gagal mengirim foto.");
  }
}

function buildTelegramText(data) {
  return [
    `🛡️ <b>PENGAJUAN ${escapeHtml(data.claimType.toUpperCase())} BARU</b>`,
    "",
    `🆔 <b>ID:</b> <code>${escapeHtml(data.id)}</code>`,
    `👤 <b>Nama:</b> ${escapeHtml(data.name)}`,
    `📱 <b>WhatsApp:</b> ${escapeHtml(data.whatsapp)}`,
    `📦 <b>Produk:</b> ${escapeHtml(data.product)}`,
    `📧 <b>Email/Akun:</b> ${escapeHtml(data.account || "-")}`,
    `🧾 <b>ID Order:</b> ${escapeHtml(data.orderId || "-")}`,
    `📅 <b>Tanggal Order:</b> ${escapeHtml(data.orderDate || "-")}`,
    `⏳ <b>Durasi:</b> ${escapeHtml(data.duration || "-")}`,
    "",
    "📝 <b>Kendala:</b>",
    escapeHtml(data.problem),
    "",
    "⏱️ <b>Status:</b> Menunggu"
  ].join("\n");
}

function getCorsHeaders(request, env) {
  const requestOrigin = (request.headers.get("Origin") || "").replace(/\/+$/, "");
  const configured = clean(env.ALLOWED_ORIGIN || "*");

  let allowedOrigin = "*";

  if (configured !== "*") {
    const origins = configured
      .split(",")
      .map(v => v.trim().replace(/\/+$/, ""))
      .filter(Boolean);

    allowedOrigin = origins.includes(requestOrigin)
      ? requestOrigin
      : origins[0] || "*";
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function normalizePath(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeWhatsapp(value) {
  let n = clean(value).replace(/\D/g, "");
  if (n.startsWith("0")) n = `62${n.slice(1)}`;
  else if (n.startsWith("8")) n = `62${n}`;
  return n;
}

function generateId() {
  const d = new Date();
  const date =
    String(d.getUTCFullYear()).slice(-2) +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0");
  const rand = crypto.getRandomValues(new Uint32Array(1))[0] % 100000;
  return `GRN-${date}-${String(rand).padStart(5, "0")}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      ...JSON_HEADERS,
      "Cache-Control": "no-store"
    }
  });
}
