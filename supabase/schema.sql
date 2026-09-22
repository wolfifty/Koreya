-- Таблица клиентов бота
create table if not exists users (
  chat_id     bigint primary key,
  username    text,
  first_name  text,
  goal        text,           -- "Поступление" | "Для себя" (грубая цель, ответ на первый вопрос)
  branch      text,           -- итоговая ветка на русском, см. ниже
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Возможные значения branch:
--   'Поступление'
--   'Для себя — с нуля'
--   'Для себя — знает алфавит'
-- Пока пользователь не дошёл до конца дерева, branch может быть NULL или равен goal.

create index if not exists users_branch_idx on users (branch);
create index if not exists users_created_at_idx on users (created_at);
