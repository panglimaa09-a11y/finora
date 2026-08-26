create extension if not exists pgcrypto;

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  wallet_code text not null unique,
  currency text not null default 'IDR' check (currency='IDR'),
  available_balance numeric(20,2) not null default 0 check (available_balance>=0),
  pending_balance numeric(20,2) not null default 0 check (pending_balance>=0),
  status text not null default 'active' check (status in ('active','locked','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  direction text not null check (direction in ('credit','debit')),
  entry_type text not null check (entry_type in ('topup','withdrawal','transfer_in','transfer_out','fee','adjustment')),
  amount numeric(20,2) not null check (amount>0),
  currency text not null default 'IDR',
  status text not null default 'pending' check (status in ('pending','posted','failed','reversed')),
  external_reference text,
  idempotency_key text unique,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.topups (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(20,2) not null check(amount>0),
  method text not null,
  provider text,
  provider_reference text unique,
  status text not null default 'pending' check(status in ('pending','paid','failed','expired','cancelled')),
  payment_url text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(20,2) not null check(amount>0),
  bank_code text not null,
  account_number text not null,
  account_name text not null,
  provider text,
  provider_reference text unique,
  status text not null default 'pending' check(status in ('pending','processing','paid','failed','cancelled')),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.ensure_wallet() returns public.wallets language plpgsql security definer set search_path=public as $$
declare w public.wallets;
begin
 select * into w from public.wallets where user_id=auth.uid();
 if w.id is null then
   insert into public.wallets(user_id,wallet_code) values(auth.uid(),'FN-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))) returning * into w;
 end if;
 return w;
end $$;

create or replace function public.post_topup(p_topup_id uuid, p_provider_reference text) returns void language plpgsql security definer set search_path=public as $$
declare t public.topups; w public.wallets;
begin
 select * into t from public.topups where id=p_topup_id for update;
 if t.id is null then raise exception 'TOPUP_NOT_FOUND'; end if;
 if t.status='paid' then return; end if;
 select * into w from public.wallets where id=t.wallet_id for update;
 update public.topups set status='paid',provider_reference=coalesce(p_provider_reference,provider_reference),updated_at=now() where id=t.id;
 update public.wallets set available_balance=available_balance+t.amount,updated_at=now() where id=w.id;
 insert into public.ledger_entries(wallet_id,user_id,direction,entry_type,amount,status,external_reference,idempotency_key,description,metadata) values(w.id,t.user_id,'credit','topup',t.amount,'posted',p_provider_reference,'topup:'||t.id::text,'Top up wallet',jsonb_build_object('topup_id',t.id));
end $$;

create or replace function public.create_withdrawal(p_amount numeric,p_bank_code text,p_account_number text,p_account_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare w public.wallets; wid uuid;
begin
 select * into w from public.wallets where user_id=auth.uid() for update;
 if w.id is null then raise exception 'WALLET_NOT_FOUND'; end if;
 if w.status<>'active' then raise exception 'WALLET_LOCKED'; end if;
 if p_amount<=0 or w.available_balance<p_amount then raise exception 'INSUFFICIENT_BALANCE'; end if;
 update public.wallets set available_balance=available_balance-p_amount,pending_balance=pending_balance+p_amount,updated_at=now() where id=w.id;
 insert into public.withdrawals(wallet_id,user_id,amount,bank_code,account_number,account_name) values(w.id,auth.uid(),p_amount,p_bank_code,p_account_number,p_account_name) returning id into wid;
 insert into public.ledger_entries(wallet_id,user_id,direction,entry_type,amount,status,idempotency_key,description,metadata) values(w.id,auth.uid(),'debit','withdrawal',p_amount,'pending','withdrawal:'||wid::text,'Penarikan dana',jsonb_build_object('withdrawal_id',wid));
 return wid;
end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.wallets(user_id,wallet_code) values(new.id,'FN-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))) on conflict(user_id) do nothing; return new; end $$;
drop trigger if exists on_auth_user_created_wallet on auth.users;
create trigger on_auth_user_created_wallet after insert on auth.users for each row execute function public.handle_new_user();

alter table public.wallets enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.topups enable row level security;
alter table public.withdrawals enable row level security;

drop policy if exists wallet_select_own on public.wallets; create policy wallet_select_own on public.wallets for select using(auth.uid()=user_id);
drop policy if exists ledger_select_own on public.ledger_entries; create policy ledger_select_own on public.ledger_entries for select using(auth.uid()=user_id);
drop policy if exists topup_select_own on public.topups; create policy topup_select_own on public.topups for select using(auth.uid()=user_id);
drop policy if exists withdrawal_select_own on public.withdrawals; create policy withdrawal_select_own on public.withdrawals for select using(auth.uid()=user_id);

grant execute on function public.ensure_wallet() to authenticated;
grant execute on function public.post_topup(uuid,text) to service_role;
grant execute on function public.create_withdrawal(numeric,text,text,text) to authenticated;

-- FINORA V3 payment/reconciliation layer
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider,event_id)
);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  topup_id uuid references public.topups(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  provider text not null,
  provider_reference text unique,
  amount numeric(20,2) not null check(amount>0),
  method text not null,
  status text not null default 'pending' check(status in ('pending','paid','failed','expired','cancelled')),
  expires_at timestamptz,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check(severity in ('info','warning','critical')),
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.webhook_events enable row level security;
alter table public.payment_orders enable row level security;
alter table public.security_events enable row level security;

create index if not exists idx_ledger_wallet_created on public.ledger_entries(wallet_id,created_at desc);
create index if not exists idx_topups_user_created on public.topups(user_id,created_at desc);
create index if not exists idx_withdrawals_user_created on public.withdrawals(user_id,created_at desc);
create index if not exists idx_webhook_events_provider_event on public.webhook_events(provider,event_id);

-- Fail closed: only the server role may post a verified top-up.
revoke all on function public.post_topup(uuid,text) from public, anon, authenticated;
grant execute on function public.post_topup(uuid,text) to service_role;
