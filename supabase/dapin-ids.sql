-- DAPIN: human-readable IDs for every business record.
-- Scope: DAPIN tables only. FINORA Wallet tables are intentionally untouched.

create sequence if not exists public.dapin_member_no_seq;
create sequence if not exists public.dapin_savings_no_seq;
create sequence if not exists public.dapin_loan_no_seq;
create sequence if not exists public.dapin_payment_no_seq;
create sequence if not exists public.dapin_transaction_no_seq;

alter table public.dapin_members
  add column if not exists member_no bigint,
  add column if not exists display_id text;

alter table public.dapin_savings
  add column if not exists record_no bigint,
  add column if not exists display_id text;

alter table public.dapin_loans
  add column if not exists loan_no bigint,
  add column if not exists display_id text;

alter table public.dapin_loan_payments
  add column if not exists payment_no bigint,
  add column if not exists display_id text;

alter table public.dapin_transactions
  add column if not exists transaction_no bigint,
  add column if not exists display_id text;

-- Backfill existing records first.
update public.dapin_members
set member_no = nextval('public.dapin_member_no_seq')
where member_no is null;

update public.dapin_savings
set record_no = nextval('public.dapin_savings_no_seq')
where record_no is null;

update public.dapin_loans
set loan_no = nextval('public.dapin_loan_no_seq')
where loan_no is null;

update public.dapin_loan_payments
set payment_no = nextval('public.dapin_payment_no_seq')
where payment_no is null;

update public.dapin_transactions
set transaction_no = nextval('public.dapin_transaction_no_seq')
where transaction_no is null;

alter table public.dapin_members alter column member_no set not null;
alter table public.dapin_members alter column display_id set not null;

alter table public.dapin_savings alter column record_no set not null;
alter table public.dapin_savings alter column display_id set not null;

alter table public.dapin_loans alter column loan_no set not null;
alter table public.dapin_loans alter column display_id set not null;

alter table public.dapin_loan_payments alter column payment_no set not null;
alter table public.dapin_loan_payments alter column display_id set not null;

alter table public.dapin_transactions alter column transaction_no set not null;
alter table public.dapin_transactions alter column display_id set not null;

update public.dapin_members set display_id = 'DAP-MBR-' || lpad(member_no::text, 6, '0') where display_id is null or display_id = '';
update public.dapin_savings set display_id = 'DAP-SAV-' || lpad(record_no::text, 6, '0') where display_id is null or display_id = '';
update public.dapin_loans set display_id = 'DAP-LON-' || lpad(loan_no::text, 6, '0') where display_id is null or display_id = '';
update public.dapin_loan_payments set display_id = 'DAP-PAY-' || lpad(payment_no::text, 6, '0') where display_id is null or display_id = '';
update public.dapin_transactions set display_id = 'DAP-TXN-' || lpad(transaction_no::text, 6, '0') where display_id is null or display_id = '';

alter table public.dapin_members alter column member_no set default nextval('public.dapin_member_no_seq');
alter table public.dapin_members alter column display_id set default 'DAP-MBR-' || lpad(nextval('public.dapin_member_no_seq')::text, 6, '0');

-- Use triggers so one sequence value is consumed per inserted row and display_id matches member_no.
create or replace function public.set_dapin_member_display_id() returns trigger
language plpgsql as $$
begin
  if new.member_no is null then new.member_no := nextval('public.dapin_member_no_seq'); end if;
  if new.display_id is null or new.display_id = '' then new.display_id := 'DAP-MBR-' || lpad(new.member_no::text,6,'0'); end if;
  return new;
end $$;

drop trigger if exists dapin_members_assign_id on public.dapin_members;
create trigger dapin_members_assign_id before insert on public.dapin_members for each row execute function public.set_dapin_member_display_id();

create or replace function public.set_dapin_savings_display_id() returns trigger
language plpgsql as $$
begin
  if new.record_no is null then new.record_no := nextval('public.dapin_savings_no_seq'); end if;
  if new.display_id is null or new.display_id = '' then new.display_id := 'DAP-SAV-' || lpad(new.record_no::text,6,'0'); end if;
  return new;
end $$;
drop trigger if exists dapin_savings_assign_id on public.dapin_savings;
create trigger dapin_savings_assign_id before insert on public.dapin_savings for each row execute function public.set_dapin_savings_display_id();

create or replace function public.set_dapin_loan_display_id() returns trigger
language plpgsql as $$
begin
  if new.loan_no is null then new.loan_no := nextval('public.dapin_loan_no_seq'); end if;
  if new.display_id is null or new.display_id = '' then new.display_id := 'DAP-LON-' || lpad(new.loan_no::text,6,'0'); end if;
  return new;
end $$;
drop trigger if exists dapin_loans_assign_id on public.dapin_loans;
create trigger dapin_loans_assign_id before insert on public.dapin_loans for each row execute function public.set_dapin_loan_display_id();

create or replace function public.set_dapin_payment_display_id() returns trigger
language plpgsql as $$
begin
  if new.payment_no is null then new.payment_no := nextval('public.dapin_payment_no_seq'); end if;
  if new.display_id is null or new.display_id = '' then new.display_id := 'DAP-PAY-' || lpad(new.payment_no::text,6,'0'); end if;
  return new;
end $$;
drop trigger if exists dapin_payments_assign_id on public.dapin_loan_payments;
create trigger dapin_payments_assign_id before insert on public.dapin_loan_payments for each row execute function public.set_dapin_payment_display_id();

create or replace function public.set_dapin_transaction_display_id() returns trigger
language plpgsql as $$
begin
  if new.transaction_no is null then new.transaction_no := nextval('public.dapin_transaction_no_seq'); end if;
  if new.display_id is null or new.display_id = '' then new.display_id := 'DAP-TXN-' || lpad(new.transaction_no::text,6,'0'); end if;
  return new;
end $$;
drop trigger if exists dapin_transactions_assign_id on public.dapin_transactions;
create trigger dapin_transactions_assign_id before insert on public.dapin_transactions for each row execute function public.set_dapin_transaction_display_id();

create unique index if not exists uq_dapin_members_member_no on public.dapin_members(member_no);
create unique index if not exists uq_dapin_members_display_id on public.dapin_members(display_id);
create unique index if not exists uq_dapin_savings_record_no on public.dapin_savings(record_no);
create unique index if not exists uq_dapin_savings_display_id on public.dapin_savings(display_id);
create unique index if not exists uq_dapin_loans_loan_no on public.dapin_loans(loan_no);
create unique index if not exists uq_dapin_loans_display_id on public.dapin_loans(display_id);
create unique index if not exists uq_dapin_payments_payment_no on public.dapin_loan_payments(payment_no);
create unique index if not exists uq_dapin_payments_display_id on public.dapin_loan_payments(display_id);
create unique index if not exists uq_dapin_transactions_transaction_no on public.dapin_transactions(transaction_no);
create unique index if not exists uq_dapin_transactions_display_id on public.dapin_transactions(display_id);

comment on column public.dapin_members.display_id is 'Human-readable DAPIN member ID, e.g. DAP-MBR-000001';
comment on column public.dapin_savings.display_id is 'Human-readable DAPIN savings record ID';
comment on column public.dapin_loans.display_id is 'Human-readable DAPIN loan ID';
comment on column public.dapin_loan_payments.display_id is 'Human-readable DAPIN payment ID';
comment on column public.dapin_transactions.display_id is 'Human-readable DAPIN transaction ID';
