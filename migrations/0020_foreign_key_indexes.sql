-- Performance hardening: cover foreign keys used by joins, deletes and sync queries.

create index if not exists idx_financial_transactions_account_id
  on public.financial_transactions(account_id);
create index if not exists idx_financial_transactions_party_id
  on public.financial_transactions(party_id);
create index if not exists idx_inventory_movements_product_id
  on public.inventory_movements(product_id);
create index if not exists idx_inventory_movements_warehouse_id
  on public.inventory_movements(warehouse_id);
create index if not exists idx_invoice_items_invoice_id
  on public.invoice_items(invoice_id);
create index if not exists idx_invoice_items_product_id
  on public.invoice_items(product_id);
create index if not exists idx_invoices_party_id
  on public.invoices(party_id);
create index if not exists idx_role_permissions_permission_id
  on public.role_permissions(permission_id);
create index if not exists idx_user_roles_role_id
  on public.user_roles(role_id);
create index if not exists idx_vouchers_party_id
  on public.vouchers(party_id);
create index if not exists idx_warehouse_stock_product_id
  on public.warehouse_stock(product_id);
