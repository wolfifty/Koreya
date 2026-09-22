import { createClient } from '@supabase/supabase-js';

let client = null;
export function supabase() {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });
  }
  return client;
}

// Создаёт запись при первом контакте / обновляет только переданные поля.
export async function upsertUser(patch) {
  const row = { ...patch, updated_at: new Date().toISOString() };
  const { error } = await supabase().from('users').upsert(row, { onConflict: 'chat_id' });
  if (error) console.error('Supabase upsert error:', error);
  return !error;
}

export async function listUsers() {
  const { data, error } = await supabase()
    .from('users')
    .select('chat_id, username, first_name, goal, branch, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase select error:', error);
    return [];
  }
  return data;
}

export async function listChatIds({ branch } = {}) {
  let query = supabase().from('users').select('chat_id, branch');
  if (branch) query = query.eq('branch', branch);
  const { data, error } = await query;
  if (error) {
    console.error('Supabase select error:', error);
    return [];
  }
  return data.map((r) => r.chat_id);
}
