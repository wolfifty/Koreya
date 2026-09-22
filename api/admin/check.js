import { validateInitData, isAdmin } from '../_lib/telegram.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const { initData } = req.body || {};
  const user = validateInitData(initData, process.env.TELEGRAM_BOT_TOKEN);

  if (!user || !isAdmin(user.id)) {
    res.status(403).json({ ok: false });
    return;
  }

  res.status(200).json({
    ok: true,
    user: { id: user.id, first_name: user.first_name, username: user.username },
  });
}
