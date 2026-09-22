import fs from 'fs';
import crypto from 'crypto';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// Базовый вызов метода Telegram Bot API (JSON body)
export async function tg(method, params = {}) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(`Telegram API error [${method}]:`, JSON.stringify(data));
  }
  return data;
}

export async function sendMessage(chatId, text, extra = {}) {
  return tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    ...extra,
  });
}

export async function answerCallbackQuery(id, extra = {}) {
  return tg('answerCallbackQuery', { callback_query_id: id, ...extra });
}

// Отправка альбома из локальных файлов (public/images/*.jpg), без подписи и без кнопок —
// Telegram не позволяет inline-клавиатуру на media group, поэтому текст с кнопками шлём отдельным сообщением следом.
export async function sendPhotoAlbum(chatId, filePaths) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  const media = filePaths.map((_, i) => ({ type: 'photo', media: `attach://photo${i}` }));
  form.append('media', JSON.stringify(media));
  filePaths.forEach((p, i) => {
    const buf = fs.readFileSync(p);
    form.append(`photo${i}`, new Blob([buf]), `photo${i}.jpg`);
  });
  const res = await fetch(`${API}/sendMediaGroup`, { method: 'POST', body: form });
  const data = await res.json();
  if (!data.ok) {
    console.error('Telegram API error [sendMediaGroup]:', JSON.stringify(data));
  }
  return data;
}

export function inlineKeyboard(rows) {
  return { reply_markup: { inline_keyboard: rows } };
}

export function consultButton(clientUsername) {
  const url = `https://t.me/${clientUsername}?text=${encodeURIComponent('консультация')}`;
  return [[{ text: 'Консультация', url }]];
}

// Проверка подписи initData от Telegram Mini App (для админки)
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export function validateInitData(initData, botToken, maxAgeSeconds = 86400) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const pairs = [];
  for (const key of [...params.keys()].sort()) {
    pairs.push(`${key}=${params.get(key)}`);
  }
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) return null;

  const authDate = Number(params.get('auth_date') || 0);
  if (maxAgeSeconds && authDate && Date.now() / 1000 - authDate > maxAgeSeconds) {
    return null;
  }

  const userStr = params.get('user');
  return userStr ? JSON.parse(userStr) : null;
}

export function isAdmin(userId) {
  const ids = (process.env.ADMIN_CHAT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(String(userId));
}
