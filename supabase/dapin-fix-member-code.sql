-- DAPIN HOTFIX: ensure member `code` is always generated before NOT NULL validation.
-- Scope: DAPIN only. FINORA Wallet/Core is untouched.

-- Keep the sequence aligned with existing members.
select setval(
  'public.dapin_member_no_seq',
  greatest(coalesce((select max(member_no) from public.dapin_members), 0), 1),
  coalesce((select max(member_no) from public.dapin_members), 0) > 0
);

create or replace function public.set_dapin_member_code()
returns trigger
language plpgsql
as $$
begin
  if new.member_no is null then
    new.member_no := nextval('public.dapin_member_no_seq');
  end if;

  -- Existing DAPIN schema has code NOT NULL, so generate it here.
  if new.code is null or btrim(new.code) = '' then
    new.code := 'DAP-MBR-' || lpad(new.member_no::text, 6, '0');
  end if;

  -- Keep the newer display_id field synchronized when it exists.
  if new.display_id is null or btrim(new.display_id) = '' then
    new.display_id := new.code;
  end if;

  return new;
end;
$$;

drop trigger if exists dapin_members_assign_code on public.dapin_members;
create trigger dapin_members_assign_code
before insert on public.dapin_members
for each row execute function public.set_dapin_member_code();

-- Repair legacy rows if any exist with a missing code.
update public.dapin_members
set code = 'DAP-MBR-' || lpad(member_no::text, 6, '0')
where (code is null or btrim(code) = '')
  and member_no is not null;

update public.dapin_members
set display_id = code
where (display_id is null or btrim(display_id) = '')
  and code is not null;
