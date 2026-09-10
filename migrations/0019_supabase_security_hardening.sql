-- Supabase production hardening.
-- App data is accessed through trusted server-side Postgres connections; browser
-- clients must not receive direct table access. RLS therefore stays enabled with
-- no permissive policies until a browser-side Data API access path is introduced.

alter table public.user enable row level security;
alter table public._migrations enable row level security;
alter table public.session enable row level security;
alter table public.account enable row level security;
alter table public.verification enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.permissions enable row level security;
alter table public.warehouses enable row level security;
alter table public.warehouse_stock enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.accounts enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.product_categories enable row level security;
alter table public.audit_events enable row level security;
alter table public.user_roles enable row level security;
alter table public.invoice_items enable row level security;
alter table public.audit_logs enable row level security;
alter table public.organization_profile enable row level security;
alter table public.sync_outbox enable row level security;
alter table public.processed_operations enable row level security;
alter table public.invoices enable row level security;
alter table public.parties enable row level security;
alter table public.products enable row level security;
alter table public.vouchers enable row level security;
alter table public.expenses enable row level security;
alter table public.sync_conflicts enable row level security;
alter table public.employees enable row level security;
alter table public.employee_users enable row level security;

alter function public.assign_default_operator_role()
  set search_path = public, pg_catalog;
alter function public.prevent_audit_event_mutation()
  set search_path = public, pg_catalog;
alter function public.bump_sync_version()
  set search_path = public, pg_catalog;
alter function public.touch_sync_version()
  set search_path = public, pg_catalog;
