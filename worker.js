export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (request.method === 'OPTIONS') return new Response(null,{headers:cors});
    if (request.method !== 'POST') return json({error:'Method tidak diizinkan'},405,cors);

    try {
      const form = await request.formData();
      const get = key => String(form.get(key) || '').trim();
      const phone = get('customerContact').replace(/\D/g,'');
      if (!/^62\d{8,13}$/.test(phone)) return json({error:'Nomor WhatsApp tidak valid'},400,cors);

      const required = ['customerName','productName','orderId','problem'];
      for (const key of required) if (!get(key)) return json({error:`Field ${key} wajib diisi`},400,cors);

      const claimId = `GRN-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
      const text = [
        '🛡️ <b>PENGAJUAN GARANSI BARU — JUASTORE</b>',
        '',
        `🆔 ID Garansi: <code>${esc(claimId)}</code>`,
        `👤 Nama: ${esc(get('customerName'))}`,
        `📱 WhatsApp: <code>${esc(phone)}</code>`,
        '',
        `📦 Produk: ${esc(get('productName'))}`,
        `💰 Harga: Rp ${esc(get('price') || '0')}`,
        `⏳ Durasi: ${esc(get('duration') || '-')}`,
        `📅 Tanggal Order: ${esc(get('orderDate') || '-')}`,
        `🧾 ID Order: ${esc(get('orderId'))}`,
        `💳 Pembayaran: ${esc(get('payment') || '-')}`,
        `🛡 Jenis: ${esc(get('claimType') || 'Garansi')}`,
        '',
        '<b>📝 Masalah / Kendala:</b>',
        esc(get('problem')),
        '',
        `💬 <a href="https://wa.me/${phone}?text=${encodeURIComponent(`Halo, pengajuan garansi JuaStore ${claimId} sedang kami cek.`)}">Balas customer via WhatsApp</a>`
      ].join('\n');

      const base = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
      const evidence = form.get('evidence');
      let result;
      if (evidence && typeof evidence !== 'string' && evidence.size > 0) {
        if (evidence.size > 5 * 1024 * 1024) return json({error:'Screenshot maksimal 5 MB'},400,cors);
        const tg = new FormData();
        tg.append('chat_id', env.TELEGRAM_CHAT_ID);
        tg.append('caption', text.slice(0,1024));
        tg.append('parse_mode','HTML');
        tg.append('photo', evidence, evidence.name || 'bukti.jpg');
        result = await fetch(`${base}/sendPhoto`,{method:'POST',body:tg});
      } else {
        result = await fetch(`${base}/sendMessage`,{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text,parse_mode:'HTML',disable_web_page_preview:true})
        });
      }
      const tgResult = await result.json();
      if (!tgResult.ok) throw new Error(tgResult.description || 'Telegram API gagal');

      return json({ok:true,claimId},200,cors);
    } catch (error) {
      return json({error:'Server gagal mengirim pengajuan: '+error.message},500,cors);
    }
  }
};

function esc(value){
  return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function json(data,status,headers){
  return new Response(JSON.stringify(data),{status,headers:{...headers,'content-type':'application/json;charset=UTF-8'}});
}
