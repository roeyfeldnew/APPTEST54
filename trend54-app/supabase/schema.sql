-- הרצה חד-פעמית ב-Supabase: SQL Editor -> New Query -> הדביקו את כל הקובץ -> Run

create extension if not exists "pgcrypto";

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  slug text unique not null,
  created_at timestamptz default now()
);

create table if not exists scenes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  scene_id uuid references scenes(id) on delete set null,
  storage_path text not null,
  -- מערך של "טביעות אצבע" של פנים שזוהו בתמונה (128 מספרים לכל פרצוף)
  face_descriptors jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- תמונת הקאבר של האירוע מוצגת בראש דף האורח.
alter table events add column if not exists cover_photo_id uuid references photos(id) on delete set null;

-- הרשאות גישה בסיסיות למצב MVP.
-- אזהרה: זה פותח קריאה/כתיבה לכולם עם ה-anon key. מתאים לבדיקות ולאירוע ראשון,
-- אך לפני שימוש מסחרי רחב מומלץ להוסיף הזדהות (auth) לצלם ולהגביל בהתאם.
alter table events enable row level security;
alter table scenes enable row level security;
alter table photos enable row level security;

create policy "public read events" on events for select using (true);
create policy "public insert events" on events for insert with check (true);

create policy "public read scenes" on scenes for select using (true);
create policy "public insert scenes" on scenes for insert with check (true);
create policy "public delete scenes" on scenes for delete using (true);

create policy "public read photos" on photos for select using (true);
create policy "public insert photos" on photos for insert with check (true);
create policy "public delete photos" on photos for delete using (true);

-- צריך גם ליצור Storage Bucket בשם "photos" (ציבורי) דרך הממשק של Supabase:
-- Storage -> New bucket -> שם: photos -> Public bucket: כן
