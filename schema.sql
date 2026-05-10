-- =====================================================================
-- EDELFRAGRANCE RECHNUNGS-DATENBANK
-- Komplettes Schema zum Einfügen in den Supabase SQL Editor
-- =====================================================================
-- Setup: Bei https://supabase.com neues Projekt anlegen → SQL Editor →
-- diesen Code reinkopieren → "Run" drücken. Fertig.
-- =====================================================================

-- ---- EINSTELLUNGEN (eine Zeile pro User) ----
create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text default 'Edelfragrance',
  owner_name text,
  street text,
  zip text,
  city text,
  country text default 'Deutschland',
  email text,
  phone text,
  website text,
  tax_id text,
  iban text,
  bic text,
  bank_name text,
  next_invoice_number int default 1,
  invoice_prefix text default 'EF',
  footer_text text default 'Vielen Dank für Ihren Einkauf!',
  default_payment_days int default 14,
  updated_at timestamptz default now()
);

-- ---- KUNDEN ----
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  street text,
  zip text,
  city text,
  country text default 'Deutschland',
  notes text,
  created_at timestamptz default now()
);
create index customers_user_idx on public.customers (user_id);
create index customers_name_idx on public.customers (name);

-- ---- PRODUKTE ----
create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text,
  name text not null,
  brand text,
  description text,
  unit_price numeric(10,2) not null default 0,
  unit text default 'Stück',
  created_at timestamptz default now()
);
create index products_user_idx on public.products (user_id);

-- ---- RECHNUNGEN ----
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_number text not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_snapshot jsonb,
  invoice_date date not null default current_date,
  due_date date,
  status text not null default 'draft',
  notes text,
  total_amount numeric(10,2) not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index invoices_user_idx on public.invoices (user_id);
create index invoices_number_idx on public.invoices (invoice_number);
create index invoices_status_idx on public.invoices (status);

-- ---- RECHNUNGSPOSITIONEN ----
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position int not null default 1,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0,
  total numeric(10,2) generated always as (quantity * unit_price) stored
);
create index items_invoice_idx on public.invoice_items (invoice_id);

-- ---- ROW-LEVEL SECURITY ----
alter table public.settings enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

create policy "settings_self" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "customers_self" on public.customers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "products_self" on public.products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invoices_self" on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "items_via_invoice" on public.invoice_items
  for all using (
    exists (select 1 from public.invoices i
            where i.id = invoice_items.invoice_id and i.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.invoices i
            where i.id = invoice_items.invoice_id and i.user_id = auth.uid())
  );

-- ---- AUTO-CREATE settings-Zeile bei Signup ----
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---- updated_at Trigger ----
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger settings_updated_at
  before update on public.settings
  for each row execute procedure public.set_updated_at();
create trigger invoices_updated_at
  before update on public.invoices
  for each row execute procedure public.set_updated_at();
