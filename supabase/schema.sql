create extension if not exists "pgcrypto";

insert into storage.buckets (id, name, public)
values ('course-assets', 'course-assets', true)
on conflict (id) do update set public = true;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  login_password text not null default '',
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists login_password text not null default '';

create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

insert into public.app_settings (key, value)
values ('initial_admin_email', 'teacher@emad-hamdy.com')
on conflict (key) do nothing;

insert into public.app_settings (key, value)
values ('initial_admin_password', 'Emad@123456')
on conflict (key) do nothing;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  grade text not null,
  price integer not null default 0,
  description text not null default '',
  image_url text not null default '',
  attachments jsonb not null default '[]',
  teacher_name text not null default 'مستر عماد حمدي',
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.courses
  add column if not exists attachments jsonb not null default '[]';

create table if not exists public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  image_url text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.course_sections
  add column if not exists image_url text not null default '';

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.course_sections(id) on delete cascade,
  title text not null,
  video_url text not null,
  thumbnail_url text not null default '',
  attachments jsonb not null default '[]',
  external_links jsonb not null default '[]',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  title text not null,
  body text not null,
  image_url text not null default '',
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  check ((lesson_id is not null and post_id is null) or (lesson_id is null and post_id is not null))
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_email text;
  admin_password text;
begin
  select value into admin_email from public.app_settings where key = 'initial_admin_email';
  select value into admin_password from public.app_settings where key = 'initial_admin_password';

  insert into public.profiles (id, full_name, email, login_password, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(
      new.raw_user_meta_data->>'login_password',
      case when lower(new.email) = lower(admin_email) then admin_password else '' end
    ),
    case when lower(new.email) = lower(admin_email) then 'admin' else 'student' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin' and new.role <> 'admin' then
    if (select count(*) from public.profiles where role = 'admin') <= 1 then
      raise exception 'Cannot remove the last admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_last_admin_removal_trigger on public.profiles;
create trigger prevent_last_admin_removal_trigger
  before update on public.profiles
  for each row execute function public.prevent_last_admin_removal();

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.courses enable row level security;
alter table public.course_sections enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "course assets public read" on storage.objects;
create policy "course assets public read" on storage.objects
  for select using (bucket_id = 'course-assets');

drop policy if exists "admins upload course assets" on storage.objects;
create policy "admins upload course assets" on storage.objects
  for insert with check (bucket_id = 'course-assets' and public.is_admin());

drop policy if exists "admins update course assets" on storage.objects;
create policy "admins update course assets" on storage.objects
  for update using (bucket_id = 'course-assets' and public.is_admin())
  with check (bucket_id = 'course-assets' and public.is_admin());

drop policy if exists "admins delete course assets" on storage.objects;
create policy "admins delete course assets" on storage.objects
  for delete using (bucket_id = 'course-assets' and public.is_admin());

create policy "profiles read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles insert own student" on public.profiles
  for insert with check (
    id = auth.uid()
    and email = (auth.jwt() ->> 'email')
    and role = 'student'
  );
create policy "profiles update admin only" on public.profiles
  for update using (public.is_admin());

create policy "published courses are public" on public.courses
  for select using (is_published = true or public.is_admin());
create policy "admins manage courses" on public.courses
  for all using (public.is_admin()) with check (public.is_admin());

create policy "sections visible for published courses" on public.course_sections
  for select using (
    exists (select 1 from public.courses c where c.id = course_id and (c.is_published or public.is_admin()))
  );
create policy "admins manage sections" on public.course_sections
  for all using (public.is_admin()) with check (public.is_admin());

create policy "lessons visible to enrolled students or admins" on public.lessons
  for select using (
    public.is_admin() or exists (
      select 1
      from public.course_sections s
      join public.courses c on c.id = s.course_id
      left join public.enrollments e on e.course_id = c.id and e.user_id = auth.uid()
      where s.id = section_id
        and c.is_published
        and (
          c.price <= 0
          or e.status = 'active'
        )
    )
  );
create policy "admins manage lessons" on public.lessons
  for all using (public.is_admin()) with check (public.is_admin());

create policy "enrollments visible own or admin" on public.enrollments
  for select using (user_id = auth.uid() or public.is_admin());
create policy "students request enrollment" on public.enrollments
  for insert with check (user_id = auth.uid());
create policy "admins manage enrollments" on public.enrollments
  for update using (public.is_admin()) with check (public.is_admin());

create policy "published posts are public" on public.posts
  for select using (is_published = true or public.is_admin());
create policy "admins manage posts" on public.posts
  for all using (public.is_admin()) with check (public.is_admin());

create policy "comments read signed in" on public.comments
  for select using (auth.uid() is not null);
create policy "comments insert own" on public.comments
  for insert with check (user_id = auth.uid());
create policy "comments manage own or admin" on public.comments
  for update using (user_id = auth.uid() or public.is_admin());

create policy "support insert public" on public.support_messages
  for insert with check (user_id is null or user_id = auth.uid());
create policy "support read own or admin" on public.support_messages
  for select using (user_id = auth.uid() or public.is_admin());
create policy "support admin update" on public.support_messages
  for update using (public.is_admin()) with check (public.is_admin());

-- Function to count lessons per course (bypasses RLS so students see video counts)
create or replace function public.get_course_lesson_counts()
returns table (course_id uuid, lesson_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.id as course_id, count(l.id) as lesson_count
  from public.courses c
  left join public.course_sections s on s.course_id = c.id
  left join public.lessons l on l.section_id = s.id
  where c.is_published = true
  group by c.id;
$$;
