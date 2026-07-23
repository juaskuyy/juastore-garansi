export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET") {
      return jsonResponse(
        { success: true, message: "JuaStore Garansi API aktif." },
        200,
        corsHeaders
      );
    }

    if (request.method !== "POST") {
      return jsonResponse(
        { success: false, message: "Metode tidak didukung." },
        405,
        corsHeaders
      );
    }

    try {
      if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
        throw new Error("Variabel Telegram belum dipasang di Cloudflare.");
      }

      const contentType = request.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        return jsonResponse(
          { success: false, message: "Content-Type harus application/json." },
          400,
          corsHeaders
        );
      }

      const body = await request.json();

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
        return jsonResponse(
          {
            success: false,
            message: "Nama, WhatsApp, produk, dan kendala wajib diisi."
          },
          400,
          corsHeaders
        );
      }

      if (!/^62[0-9]{8,13}$/.test(whatsapp)) {
        return jsonResponse(
          { success: false, message: "Nomor WhatsApp tidak valid." },
          400,
          corsHeaders
        );
      }

      const warrantyId = createWarrantyId();

      const telegramText =
        `🛡️ <b>PENGAJUAN ${escapeHtml(claimType.toUpperCase())} BARU</b>\n\n` +
        `🆔 <b>ID Garansi:</b> <code>${escapeHtml(warrantyId)}</code>\n` +
        `👤 <b>Nama:</b> ${escapeHtml(name)}\n` +
        `📱 <b>WhatsApp:</b> ${escapeHtml(whatsapp)}\n` +
        `📦 <b>Produk:</b> ${escapeHtml(product)}\n` +
        `📧 <b>Email/Akun:</b> ${escapeHtml(account || "-")}\n` +
        `🧾 <b>ID Order:</b> ${escapeHtml(orderId || "-")}\n` +
        `📅 <b>Tanggal Order:</b> ${escapeHtml(orderDate || "-")}\n` +
        `⏳ <b>Durasi:</b> ${escapeHtml(duration || "-")}\n\n` +
        `📝 <b>Kendala:</b>\n${escapeHtml(problem)}\n\n` +
        `⏱️ <b>Status:</b> Menunggu diproses`;

      const waText =
        `Halo ${name}, pengajuan ${claimType.toLowerCase()} JuaStore ` +
        `dengan ID ${warrantyId} sudah kami terima. Mohon tunggu proses pengecekan.`;

      const replyMarkup = {
        inline_keyboard: [[{
          text: "💬 Balas WhatsApp",
          url: `https://wa.me/${whatsapp}?text=${encodeURIComponent(waText)}`
        }]]
      };

      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: env.TELEGRAM_CHAT_ID,
        text: telegramText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: replyMarkup
      });

      if (evidenceDataUrl) {
        await sendPhotoFromDataUrl(
          env.TELEGRAM_BOT_TOKEN,
          env.TELEGRAM_CHAT_ID,
          evidenceDataUrl,
          `📎 Bukti screenshot\nID Garansi: ${warrantyId}`
        );
      }

      return jsonResponse(
        { success: true, message: "Pengajuan berhasil dikirim.", warrantyId, whatsapp },
        200,
        corsHeaders
      );
    } catch (error) {
      return jsonResponse(
        {
          success: false,
          message: error instanceof Error ? error.message : "Terjadi kesalahan."
        },
        500,
        corsHeaders
      );
    }
  }
};

async function telegramRequest(botToken, method, payload) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram ${method} gagal.`);
  }

  return result;
}

async function sendPhotoFromDataUrl(botToken, chatId, dataUrl, caption) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error("Format screenshot tidak didukung.");

  const mimeType = match[1];
  const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0));

  if (bytes.byteLength > 5 * 1024 * 1024) {
    throw new Error("Ukuran screenshot maksimal 5 MB.");
  }

  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  }[mimeType];

  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("caption", caption);
  formData.append(
    "photo",
    new Blob([bytes], { type: mimeType }),
    `bukti-garansi.${extension}`
  );

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendPhoto`,
    { method: "POST", body: formData }
  );

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || "Screenshot gagal dikirim.");
  }
}

function clean(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalizeWhatsapp(value) {
  let number = clean(value).replace(/\D/g, "");
  if (number.startsWith("0")) number = `62${number.slice(1)}`;
  if (number.startsWith("8")) number = `62${number}`;
  return number;
}

function createWarrantyId() {
  const date = new Date();
  const stamp =
    String(date.getUTCFullYear()).slice(-2) +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    String(date.getUTCDate()).padStart(2, "0");
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
  return `GRN-${stamp}-${String(random).padStart(4, "0")}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=UTF-8"
    }
  });
}
