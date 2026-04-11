-- Lemon Squeezy payment integration
-- Two plans: dashboard ($29/mo), complete ($35/mo with WhatsApp)

-- Update plan constraint
alter table users drop constraint if exists users_plan_check;
alter table users
  add constraint users_plan_check
  check (plan in ('free', 'dashboard', 'complete'));
alter table users alter column plan set default 'free';

-- Update existing users: active → complete, inactive → free
update users set plan = 'complete' where plan = 'active';
update users set plan = 'free' where plan = 'inactive';
update users set plan = 'free' where plan = 'starter';

-- Add Lemon Squeezy fields
alter table users add column if not exists ls_customer_id text;
alter table users add column if not exists ls_subscription_id text;
alter table users add column if not exists ls_variant_id text;
alter table users add column if not exists plan_expires_at timestamptz;
