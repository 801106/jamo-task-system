-- URUCHOM TO W SUPABASE SQL EDITOR

-- Tabela profili użytkowników
create table profiles (
  id uuid references auth.users on delete cascade,
  full_name text,
  role text default 'user' check (role in ('admin','user')),
  areas text[] default '{"jamo_healthy"}',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (id)
);

-- Tabela zadań / reklamacji
create table tasks (
  id uuid default gen_random_uuid() primary key,
  order_number text,
  claim_number text,
  product_name text not null,
  sku text,
  client_name text,
  marketplace text,
  category text,
  description text,
  status text default 'open' check (status in ('open','inprogress','waiting','done','urgent')),
  priority text default 'med' check (priority in ('high','med','low')),
  area text default 'jamo_healthy' check (area in ('jamo_healthy','packpack','private')),
  assigned_to uuid references profiles(id),
  created_by uuid references profiles(id),
  is_private boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Tabela komentarzy
create table comments (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references tasks(id) on delete cascade,
  author_id uuid references profiles(id),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Tabela powiadomień
create table notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id),
  task_id uuid references tasks(id) on delete cascade,
  type text,
  message text,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Włącz RLS
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table comments enable row level security;
alter table notifications enable row level security;

-- RLS: Profile - każdy widzi swój profil, admin widzi wszystkich
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Admin can view all profiles" on profiles for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- RLS: Tasks - użytkownik widzi zadania swojego obszaru
create policy "Users see tasks in their areas" on tasks for select using (
  exists (
    select 1 from profiles p
    where p.id = auth.uid()
    and (
      p.role = 'admin'
      or (area = any(p.areas) and (is_private = false or assigned_to = auth.uid() or created_by = auth.uid()))
    )
  )
);
create policy "Users can insert tasks" on tasks for insert with check (
  exists (select 1 from profiles where id = auth.uid())
);
create policy "Users can update own tasks or admin all" on tasks for update using (
  created_by = auth.uid()
  or assigned_to = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- RLS: Comments
create policy "Users see comments on visible tasks" on comments for select using (
  exists (select 1 from tasks where id = task_id)
);
create policy "Users can add comments" on comments for insert with check (
  auth.uid() = author_id
);

-- RLS: Notifications
create policy "Users see own notifications" on notifications for select using (user_id = auth.uid());
create policy "Users can mark notifications read" on notifications for update using (user_id = auth.uid());

-- Trigger: auto-create profile przy rejestracji
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Trigger: updated_at na tasks
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at before update on tasks
  for each row execute procedure update_updated_at();

-- Włącz Realtime dla tasks i comments
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table comments;
alter publication supabase_realtime add table notifications;
