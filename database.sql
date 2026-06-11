-- Supabase SQL schema untuk DJI Pocket Savings Tracker v7
-- Mode cloud TANPA LOGIN EMAIL.
-- Jalankan semua ini di Supabase Dashboard > SQL Editor > Run.

create table if not exists public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  vault_key text not null,
  type text not null check (type in ('income', 'expense')),
  title text not null,
  category text not null default 'Lainnya',
  amount numeric(12, 0) not null check (amount >= 0),
  trx_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.savings_transactions enable row level security;

-- Sengaja tidak membuat policy SELECT/INSERT/DELETE langsung ke tabel.
-- Akses publik hanya lewat RPC function di bawah, supaya orang tidak bisa list semua rows langsung dari table endpoint.

create index if not exists savings_transactions_vault_date_idx
on public.savings_transactions (vault_key, trx_date desc, created_at desc);

create or replace function public.get_savings_transactions(p_vault_key text)
returns table (
  id uuid,
  type text,
  title text,
  category text,
  amount numeric,
  trx_date date,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    st.id,
    st.type,
    st.title,
    st.category,
    st.amount,
    st.trx_date,
    st.created_at
  from public.savings_transactions st
  where st.vault_key = p_vault_key
  order by st.trx_date desc, st.created_at desc;
$$;

create or replace function public.add_savings_transaction(
  p_vault_key text,
  p_type text,
  p_title text,
  p_category text,
  p_amount numeric,
  p_trx_date date
)
returns table (
  id uuid,
  type text,
  title text,
  category text,
  amount numeric,
  trx_date date,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted public.savings_transactions;
begin
  if length(trim(coalesce(p_vault_key, ''))) < 8 then
    raise exception 'vault key terlalu pendek';
  end if;

  if p_type not in ('income', 'expense') then
    raise exception 'tipe transaksi tidak valid';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'judul wajib diisi';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'nominal harus lebih dari 0';
  end if;

  insert into public.savings_transactions (vault_key, type, title, category, amount, trx_date)
  values (
    p_vault_key,
    p_type,
    trim(p_title),
    coalesce(nullif(trim(p_category), ''), 'Lainnya'),
    p_amount,
    p_trx_date
  )
  returning * into inserted;

  return query
  select inserted.id, inserted.type, inserted.title, inserted.category, inserted.amount, inserted.trx_date, inserted.created_at;
end;
$$;

create or replace function public.delete_savings_transaction(p_vault_key text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.savings_transactions
  where vault_key = p_vault_key
    and id = p_id;
end;
$$;

revoke all on table public.savings_transactions from anon, authenticated;
grant execute on function public.get_savings_transactions(text) to anon, authenticated;
grant execute on function public.add_savings_transaction(text, text, text, text, numeric, date) to anon, authenticated;
grant execute on function public.delete_savings_transaction(text, uuid) to anon, authenticated;
