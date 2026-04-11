-- Add pending_whatsapp column for phone verification flow
-- When a user enters their number in Settings, it's stored here.
-- When they reply YES on WhatsApp, the webhook matches and confirms.
alter table users add column if not exists pending_whatsapp text;
