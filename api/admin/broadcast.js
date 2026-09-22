import { validateInitData, isAdmin, toTelegramHTML, sendBroadcast } from '../_lib/telegram.js';
import { listChatIds } from '../_lib/supabase.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const { initData, text, photoBase64, buttonText, buttonUrl, target, branch, chatIds } = req.body || {};
  const admin = validateInitData(initData, TOKEN);

  if (!admin || !isAdmin(admin.id)) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  if (!text && !photoBase64) {
    res.status(400).json({ error: 'text_or_photo_required' });
    return;
  }

  // Кому отправляем
  let recipients = [];
  if (target === 'selected' && Array.isArray(chatIds) && chatIds.length) {
    recipients = chatIds;
  } else if (target === 'branch' && branch) {
    recipients = await listChatIds({ branch });
  } else {
    recipients = await listChatIds();
  }

  if (recipients.length === 0) {
    res.status(200).json({ sent: 0, failed: 0, total: 0 });
    return;
  }

  const reply_markup = buttonText && buttonUrl
    ? { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] }
    : undefined;

  // Если есть фото — сначала отправляем его самому админу (это и превью перед рассылкой,
  // и способ получить file_id, чтобы дальше не перезаливать байты на каждого получателя)
  let fileId = null;
  if (photoBase64) {
    const buffer = Buffer.from(photoBase64, 'base64');
    const form = new FormData();
    form.append('chat_id', String(admin.id));
    if (text) form.append('caption', toTelegramHTML(text));
    form.append('parse_mode', 'HTML');
    form.append('photo', new Blob([buffer]), 'broadcast.jpg');
    if (reply_markup) form.append('reply_markup', JSON.stringify(reply_markup));

    let uploadRes = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, { method: 'POST', body: form });
    let uploadData = await uploadRes.json();
    if (!uploadData.ok) {
      // Подстраховка на случай сбоя разметки — пробуем без форматирования
      const plainForm = new FormData();
      plainForm.append('chat_id', String(admin.id));
      if (text) plainForm.append('caption', text);
      plainForm.append('photo', new Blob([buffer]), 'broadcast.jpg');
      if (reply_markup) plainForm.append('reply_markup', JSON.stringify(reply_markup));
      uploadRes = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, { method: 'POST', body: plainForm });
      uploadData = await uploadRes.json();
    }
    if (!uploadData.ok) {
      res.status(500).json({ error: 'photo_upload_failed', details: uploadData });
      return;
    }
    fileId = uploadData.result.photo[uploadData.result.photo.length - 1].file_id;
  }

  let sent = 0;
  let failed = 0;

  for (const chatId of recipients) {
    // Админу фото-вариант уже доставлен на шаге получения file_id — не дублируем
    if (fileId && String(chatId) === String(admin.id)) {
      sent++;
      continue;
    }
    try {
      const result = await sendBroadcast(chatId, { text, fileId, reply_markup });
      if (result.ok) sent++; else failed++;
    } catch (e) {
      failed++;
    }
    // Грубая защита от лимита Telegram (~30 сообщений/сек в разные чаты)
    await new Promise((r) => setTimeout(r, 40));
  }

  res.status(200).json({ sent, failed, total: recipients.length });
}
