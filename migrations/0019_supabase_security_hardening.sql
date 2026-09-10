-- Supabase production hardening.
-- App data is accessed through trusted server-side Postgres connections; browser
-- clients must not receive direct table access. RLS stays enabled and direct
-- anon/authenticated table privileges are revoked until a browser Data API path
-- is deliberately introduced with matching organization-scoped policies.

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

revoke all on table public.user, public._migrations, public.session, public.account,
  public.verification, public.roles, public.role_permissions, public.permissions,
  public.warehouses, public.warehouse_stock, public.inventory_movements,
  public.accounts, public.financial_transactions, public.product_categories,
  public.audit_events, public.user_roles, public.invoice_items, public.audit_logs,
  public.organization_profile, public.sync_outbox, public.processed_operations,
  public.invoices, public.parties, public.products, public.vouchers, public.expenses,
  public.sync_conflicts, public.employees, public.employee_users
from anon, authenticated;

alter function public.assign_default_operator_role()
  set search_path = public, pg_catalog;
alter function public.prevent_audit_event_mutation()
  set search_path = public, pg_catalog;
alter function public.bump_sync_version()
  set search_path = public, pg_catalog;
alter function public.touch_sync_version()
  set search_path = public, pg_catalog;
