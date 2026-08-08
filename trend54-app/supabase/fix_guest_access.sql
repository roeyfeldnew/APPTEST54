-- TREND54: תיקון חד-פעמי לגישה של דף האורח.
-- מריץ מחדש את מדיניות הקריאה כך שה-anon key יוכל לקרוא אירוע ותמונות.
-- בטוח להרצה גם אם המדיניות כבר קיימת.

drop policy if exists "public read events" on public.events;
create policy "public read events" on public.events
for select to anon, authenticated using (true);

drop policy if exists "public read scenes" on public.scenes;
create policy "public read scenes" on public.scenes
for select to anon, authenticated using (true);

drop policy if exists "public read photos" on public.photos;
create policy "public read photos" on public.photos
for select to anon, authenticated using (true);

-- קריאת קבצים מ-Storage. ה-bucket photos צריך להיות Public.
drop policy if exists "Allow public reads" on storage.objects;
create policy "Allow public reads" on storage.objects
for select to anon, authenticated
using (bucket_id = 'photos');
