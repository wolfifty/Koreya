import { validateInitData, isAdmin } from '../_lib/telegram.js';
import { listUsers } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const { initData } = req.body || {};
  const user = validateInitData(initData, process.env.TELEGRAM_BOT_TOKEN);

  if (!user || !isAdmin(user.id)) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const users = await listUsers();
  res.status(200).json({ users });
}
