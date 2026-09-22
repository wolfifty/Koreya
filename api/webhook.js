import path from 'path';
import { sendMessage, sendPhotoAlbum, answerCallbackQuery, inlineKeyboard, consultButton, isAdmin, tg } from './_lib/telegram.js';
import { upsertUser } from './_lib/supabase.js';
import * as C from './_lib/content.js';

const CLIENT_USERNAME = process.env.CLIENT_USERNAME || 'sashaagv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).send('OK');
    return;
  }

  const update = req.body || {};

  try {
    if (update.message && update.message.text === '/start') {
      await handleStart(update.message);
    } else if (update.message && update.message.text === '/admin') {
      await handleAdmin(update.message);
    } else if (update.callback_query) {
      await handleCallback(update.callback_query);
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  // Telegram ждёт быстрый 200 OK вне зависимости от результата обработки
  res.status(200).json({ ok: true });
}

async function handleStart(message) {
  const chat = message.chat;
  const from = message.from || {};

  await upsertUser({
    chat_id: chat.id,
    username: from.username || null,
    first_name: from.first_name || null,
  });

  const imagesDir = path.join(process.cwd(), 'public', 'images');
  const photos = ['welcome-1.jpg', 'welcome-2.jpg', 'welcome-3.jpg'].map((f) => path.join(imagesDir, f));
  await sendPhotoAlbum(chat.id, photos);

  await sendMessage(chat.id, C.WELCOME_TEXT, inlineKeyboard(C.GOAL_BUTTONS));
}

async function handleAdmin(message) {
  const chatId = message.chat.id;
  // Обычным пользователям команда /admin молча ничего не отвечает
  if (!isAdmin(chatId)) return;

  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) {
    await sendMessage(chatId, 'SITE_URL не задан в переменных окружения — админка недоступна.');
    return;
  }

  await tg('sendMessage', {
    chat_id: chatId,
    text: 'Админ-панель:',
    reply_markup: {
      inline_keyboard: [[{ text: 'Открыть админку', web_app: { url: `${siteUrl}/admin` } }]],
    },
  });
}

async function handleCallback(cq) {
  const chatId = cq.message.chat.id;
  const data = cq.data;

  await answerCallbackQuery(cq.id);

  switch (data) {
    case 'goal_admission':
      await upsertUser({ chat_id: chatId, goal: C.BRANCH.ADMISSION, branch: C.BRANCH.ADMISSION });
      await sendMessage(chatId, C.ADMISSION_INTRO, inlineKeyboard(C.ADMISSION_INTRO_BUTTONS));
      break;

    case 'get_podcast':
      await sendMessage(chatId, C.ADMISSION_PODCAST_DELIVERY);
      await sendMessage(chatId, C.ADMISSION_CONSULT_INVITE, inlineKeyboard(consultButton(CLIENT_USERNAME)));
      break;

    case 'goal_personal':
      await upsertUser({ chat_id: chatId, goal: C.BRANCH.PERSONAL, branch: C.BRANCH.PERSONAL });
      await sendMessage(chatId, C.PERSONAL_EXPERIENCE_QUESTION, inlineKeyboard(C.PERSONAL_EXPERIENCE_BUTTONS));
      break;

    case 'exp_beginner':
      await upsertUser({ chat_id: chatId, branch: C.BRANCH.PERSONAL_BEGINNER });
      await sendMessage(chatId, C.BEGINNER_INTRO, inlineKeyboard(C.BEGINNER_INTRO_BUTTONS));
      break;

    case 'get_lesson':
      await sendMessage(chatId, C.LESSON_DELIVERY);
      await sendMessage(chatId, C.PERSONAL_CONSULT_INVITE, inlineKeyboard(consultButton(CLIENT_USERNAME)));
      break;

    case 'exp_alphabet':
      await upsertUser({ chat_id: chatId, branch: C.BRANCH.PERSONAL_ALPHABET });
      await sendMessage(chatId, C.ALPHABET_INTRO, inlineKeyboard(C.ALPHABET_INTRO_BUTTONS));
      break;

    case 'get_guide':
      await sendMessage(chatId, C.GUIDE_DELIVERY);
      await sendMessage(chatId, C.PERSONAL_CONSULT_INVITE, inlineKeyboard(consultButton(CLIENT_USERNAME)));
      break;

    default:
      // неизвестный callback_data — молча игнорируем
      break;
  }
}
