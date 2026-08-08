-- הרצה חד-פעמית אם schema.sql כבר הורץ בעבר:
alter table events add column if not exists cover_photo_id uuid references photos(id) on delete set null;
