-- Optional local seed data. This file is not executed by the default reset.
-- Run with:
--   npx supabase db reset --local --sql-paths ./seed.example.sql

insert into public.knowledge_branches (name, slug, sort_order)
values
  ('00-认识层', '00-awareness', 0),
  ('01-共通基础层', '01-common-foundation', 10),
  ('02-方向学习', '02-direction-learning', 20),
  ('03-就业准备', '03-career-prep', 30),
  ('04-综合', '04-comprehensive', 40)
on conflict do nothing;
