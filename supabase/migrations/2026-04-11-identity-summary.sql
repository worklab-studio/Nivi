-- Phase E.2 — Identity distillation columns
alter table brand_identity
  add column if not exists identity_summary text,
  add column if not exists identity_facets jsonb,
  add column if not exists summary_updated_at timestamptz;
